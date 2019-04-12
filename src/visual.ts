/*
 *  Power BI Visual CLI
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

module powerbi.extensibility.visual {
    
    import ValueFormatter = powerbi.extensibility.utils.formatting.valueFormatter;

    interface CircleDataPoint {
        target: number;
        forecasted?: number;
        actual: number;
    }

    export class Visual implements IVisual {
        private settings: VisualSettings;
        private host: IVisualHost;
        private circleGroup: d3.Selection<SVGElement>;
        private svg: d3.Selection<SVGElement>;
        private vis;
        private actualEndAngle ;
        private forecasterEndAngle ;
        private targetEndAngle ;
        private tooltips: VisualTooltipDataItem[];

        constructor(options: VisualConstructorOptions) {
            this.host = options.host;
            this.svg = d3.select(options.element)
                        .append("svg")
                        .classed("circle-KPI", true);
            this.circleGroup = this.svg.append("g")
                                .classed("circle=group", true);
        }

        public update(options: VisualUpdateOptions) {

            this.settings = VisualSettings.parse<VisualSettings>(options.dataViews[0]);
            var pi = Math.PI;
            this.targetEndAngle = 300*(Math.PI/180) ;
            let cirDataPoint : CircleDataPoint = {
                target : +options.dataViews[0].categorical.values[0].values ,
                forecasted : +options.dataViews[0].categorical.values[1].values ,
                actual : +options.dataViews[0].categorical.values[2].values 
            };

            if ( cirDataPoint.actual >= cirDataPoint.target) {
                this.actualEndAngle = 2*pi ;
            }
            else {
                this.actualEndAngle = (5*pi/(3*cirDataPoint.target))*cirDataPoint.actual ;
            }

            if ( cirDataPoint.forecasted >= cirDataPoint.target) {
                this.forecasterEndAngle = 2*pi ;
            }
            else {this.forecasterEndAngle = (5*pi/(3*cirDataPoint.target))*cirDataPoint.forecasted ;}

            var width = options.viewport.width;
            var height = options.viewport.height;
            var outerRadius = width/3 ;
            this.svg.attr({
                width: width,
                height: height
            });
            this.vis = this.circleGroup;

            let percent = cirDataPoint.actual*100/cirDataPoint.target ;
            percent = +percent.toFixed(2) ;

            //for animation
            var startAnimationAngle = 0;
            var interpolationTarget = d3.interpolate(startAnimationAngle, this.targetEndAngle*(180/pi));
            var interpolationForecasted = d3.interpolate(startAnimationAngle, this.forecasterEndAngle*(180/pi));
            var interpolationActual = d3.interpolate(startAnimationAngle, this.actualEndAngle*(180/pi));
            var time = 2000; 
            //end

            var targetArc = d3.svg.arc()
                .innerRadius(outerRadius * 0.9)
                .outerRadius(outerRadius)
                .startAngle(0) //converting from degs to radians
                .endAngle(this.targetEndAngle); //just radians

            var forcastedArc = d3.svg.arc()
                .innerRadius(outerRadius * 0.8)
                .outerRadius(outerRadius * 0.7)
                .startAngle(0)
                .endAngle(this.forecasterEndAngle);
            
            var actualArc = d3.svg.arc()
                .innerRadius(outerRadius*0.6)
                .outerRadius(outerRadius*0.5)
                .startAngle(0)
                .endAngle(this.actualEndAngle);
            
            this.tooltips = [] ;
            let view = options.dataViews[0].categorical;
            let columns = options.dataViews[0].metadata.columns;
            for (let i = 0, len = columns.length; i < len; i++) {
                let iValueFormatter = ValueFormatter.create({ format: view.values[i].source.format, precision: 2 });
                let value = (columns[i].type.text) ? "" + view.values[i].values[0] : (<number>view.values[i].values[0]);
                this.tooltips.push(
                    {
                        displayName: options.dataViews[0].metadata.columns[i].displayName,
                        value: iValueFormatter.format(value),
                        header: "Tooltip",
                        color: ""
                    })
            };
            this.tooltips.push({
                displayName: "actual vs target",
                value: percent+"%"
            });

            /*
            function pieTween(b) {
                b.innerRadius = 0;
                var i = d3.interpolate({startAngle: 0, endAngle: 0}, b);
                return function(t) {
                    var b = i(t);
                    return path(b);
                };
            }
            */

            this.vis.selectAll("path").remove() ;
            this.vis.attr("width", width).attr("height", height) // Added height and width so arc is visible
                .append("path")
                .attr("d", targetArc)
                .attr("fill", this.settings.myCustomObject.fillTarget)
                .attr("transform", "translate(" + width/2  + "," + height/2  + ")" )
                .on("mouseover", (d) => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];
                    this.host.tooltipService.show({
                        dataItems: this.tooltips,
                        identities: null,
                        coordinates: [x, y],
                        isTouchEvent: false

                    });
                })
                .on("mousemove", (d) => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];

                    this.host.tooltipService.move({
                        dataItems: this.tooltips,
                        identities: null,
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    this.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })
                .transition()
                .duration(time)
                .attrTween("d", (d) => {return (t) => targetArc.endAngle(interpolationTarget(t) * (Math.PI/180))(null)});
                

            //this.vis.select("path").remove();
            this.vis.attr("width", width).attr("height", height) // Added height and width so arc is visible
                .append("path")
                .attr("d", forcastedArc)
                .attr("fill", this.settings.myCustomObject.fillForecasted)
                .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
                .on("mouseover", (d) => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];
                    this.host.tooltipService.show({
                        dataItems: this.tooltips,
                        identities: null,
                        coordinates: [x, y],
                        isTouchEvent: false

                    });
                })
                .on("mousemove", (d) => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];

                    this.host.tooltipService.move({
                        dataItems: this.tooltips,
                        identities: null,
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    this.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })
                .transition()
                .duration(time)
                .attrTween("d", (d) => {return (t) => forcastedArc.endAngle(interpolationForecasted(t) * (Math.PI/180))(null)});
        
            //this.vis.select("path").remove();
            this.vis.attr("width", width).attr("height", height) // Added height and width so arc is visible
                .append("path")
                .attr("d", actualArc)
                .attr("fill", this.settings.myCustomObject.fillActual)
                .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")")
                .on("mouseover", (d) => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];
                    this.host.tooltipService.show({
                        dataItems: this.tooltips,
                        identities: null,
                        coordinates: [x, y],
                        isTouchEvent: false

                    });
                })
                .on("mousemove", (d) => {
                    let mouse = d3.mouse(this.svg.node());
                    let x = mouse[0];
                    let y = mouse[1];

                    this.host.tooltipService.move({
                        dataItems: this.tooltips,
                        identities: null,
                        coordinates: [x, y],
                        isTouchEvent: false
                    });
                })
                .on("mouseout", (d) => {
                    this.host.tooltipService.hide({
                        immediately: true,
                        isTouchEvent: false
                    });
                })
                .transition()
                .duration(time)
                .attrTween("d", (d) => {return (t) => actualArc.endAngle(interpolationActual(t) * (Math.PI/180))(null)});

            this.vis.select("text").remove();
            let text = this.vis.append("text")
                            .text(percent + " %")
                            .attr("x", width/2)
                            .attr("y", height/2)
                            .attr("font-family", "Segoe UI")
                            .attr("font-size", this.settings.myCustomObject.fontSize)
                            .attr("fill", 'black')
                            .attr("text-anchor", "middle")
                            .style("font-weight", "bold")
                            .on("mouseover", (d) => {
                                let mouse = d3.mouse(this.svg.node());
                                let x = mouse[0];
                                let y = mouse[1];
                                this.host.tooltipService.show({
                                    dataItems: this.tooltips,
                                    identities: null,
                                    coordinates: [x, y],
                                    isTouchEvent: false
        
                                });
                            })
                            .on("mousemove", (d) => {
                                let mouse = d3.mouse(this.svg.node());
                                let x = mouse[0];
                                let y = mouse[1];
            
                                this.host.tooltipService.move({
                                    dataItems: this.tooltips,
                                    identities: null,
                                    coordinates: [x, y],
                                    isTouchEvent: false
                                });
                            })
                            .on("mouseout", (d) => {
                                this.host.tooltipService.hide({
                                    immediately: true,
                                    isTouchEvent: false
                                });
                            });
            
        }

        /** 
         * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the 
         * objects and properties you want to expose to the users in the property pane.
         * 
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
            return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
        }
    }
}