define([ "backbone", "fuse", "jquery", "underscore", "text!templates/fueltmpl.html" ], function( Backbone, Fuse, $, _, fuelTmpl ) {
    return Fuse.View.extend({
        id: "fuel",
        tagName: "div",
        role: "page",
        transition: "slide",
        template: _.template( fuelTmpl ),

        events: {
            "tap .trigger-fillup"   : "showFillupForm",
            "submit #record-fillup" : "recordFillup",
            "change #num-gallons"   : "updateCost",
            "change #price-gallon"  : "updateCost"
        },

        initialize: function() {
            Fuse.View.prototype.initialize.apply( this, arguments );
        },

        render: function() {
	    Fuse.log("Rendering Fuel Page");
            var name = this.model.get('profileName') || this.model.get('label');

	    Fuse.log("Get profile");
	    this.model.set("cpm", this.model.get("cost") / this.model.get("distance"));
	    this.model.set("cpg", this.model.get("cost") / this.model.get("volume"));

            this.header = name + " " + "Fuel";
            this.content = this.template({ vehicle: this.model.toJSON() });

	    
            Fuse.View.prototype.render.call( this );
            this.renderChart();
        },

        refresh: function() {
            Fuse.flushFuelCache = true;
            Fuse.flushFuelAggCache = true;
            // Debugging...
            Backbone.history.stop();
            Backbone.history.start();
            Fuse.show(Backbone.history.fragment);
        },

        renderChart: function() {
	    this.chartCanvas = document.getElementById( "fillup-chart" ).getContext( "2d" );
            this.costs = this.controller.currentFillups.map(function( f ) { return parseFloat(f.get( "mpg" )); });
            this.dates = this.controller.currentFillups
                          .map(function( f ) { return FTH.formatDate(f.get( "timestamp" ) , { format: { with: "MMM DD" } }); });

            this.chartData = {
                labels: this.dates,
                datasets: [
                {
                    fillColor           : "rgba(219,143,60,0.5)",
                    strokeColor         : "rgba(219,143,60,1)",
                    pointColor          : "rgba(219,143,60,1)",
                    pointStrokeColor    : "#fff",
                    data                : this.costs
                }
                ]
            };

            this.chart = new Chart( this.chartCanvas ).Bar( this.chartData );
        },

        showFillupForm: function() {
            this.$popup = $( "#fuel-popup" );
            if ( this.$popup.length ) {
                this.getGasStations();
            } else {
                Fuse.log( "Popup could not be found." );
            }
        },

        recordFillup: function(e) {
            e.preventDefault();
            // Grab the values we want.
            var numGallons  = $( "#num-gallons" ).val(),
                priceGallon = $( "#price-gallon" ).val(),
                cost        = $( "#cost" ).val(),
                odometer    = $( "#odometer" ).val(),
                gasStation  = $( "#gas-station" ).val() !== "other" ? $( "#gas-station" ).val() : $( "#gs-other" ).val(),
   		when        = $( "#when" ).val();
	        
            this.controller.addFillup( numGallons, priceGallon, cost, odometer, gasStation, when );
            this.$popup.popup( "close" );
            Fuse.loading('show', 'Recording fillup...');
            var __self__ = this;
            setTimeout(function() {
                __self__.refresh();
            }, 5000);
            // alert( "Success!" );
        },

        updateCost: function( e ) {
            e.preventDefault();

            var cost = ( $( "#num-gallons" ).val() * $( "#price-gallon" ).val() ).toFixed( 2 );
            $( "#cost" ).val( cost );

            e.handled = true;
        },

	// I don't think these are used...
        // nextMonth: function() {
        //     if ( Fuse.currentMonth < 11 ) {
        //         Fuse.currentMonth += 1;
        //     } else {
        //         Fuse.currentMonth = 0;
        //     }
        // },

        // previousMonth: function() {
        //     if ( Fuse.currentMonth > 0 ) {
        //         Fuse.currentMonth -= 1;
        //     } else {
        //         Fuse.currentMonth = 11;
        //     }
        // },

        getGasStations: function() {
            // We make sure to bind the execution context of the callback to the view itself.
            Fuse.loading( "show", "Getting nearby gas stations..." );
            Fuse.map.getNearbyPlaces( "gas_station", this.populateGasStations.bind( this ) );
//            this.populateGasStations( [] );
        },

        populateGasStations: function( stations ) {

            var stationSelect = document.getElementById( "gas-station" ),
                otherOption = document.createElement( "option" );

            otherOption.setAttribute( "value", "other" );
            otherOption.innerHTML = "Other";

            stations.forEach(function( station ) {
                var info = station.name + " (" + station.vicinity + ")";
                var opt = document.createElement( "option" );
                opt.setAttribute( "value", info );
                opt.innerHTML = info;
                stationSelect.appendChild( opt );
            });
	
	    if($("#gas-station option[value=other]").length === 0) {
		stationSelect.appendChild( otherOption );
	    }

            Fuse.log( "Populated:", stationSelect, "with data:", stations );

            // Reset the form.
            $( "#num-gallons, #price-gallon, #cost, #gas-station, #gs-other" ).val( "" );
            $( "#gas-station > option[ val = 'default']" ).prop( "selected", true );
            $( "#gas-station" ).selectmenu( "refresh" );

	    var today = new Date();
	    var dd = today.getDate();
	    var mm = today.getMonth()+1; //January is 0!
	    var yyyy = today.getFullYear();

	    if(dd<10) {
		dd='0'+dd
	    } 

	    if(mm<10) {
		mm='0'+mm
	    } 
	    today = yyyy + "-" + mm + "-" + dd;

	    $( "#when" ).val(today);

            // If our model has a valid odometer value, pre-populate the odometer input.
            var odometer = this.model.get( "mileage" ) || this.model.get( "odometer" );
	    Fuse.log("Odometer: ", odometer);
            if ( odometer ) {
                $( "#odometer" ).val( odometer );
            }

	    $('#gs-other').parent().hide();
	    $('select[id=gas-station]').change(function () {
		if ($(this).val() == 'other') {
		    $('#gs-other').parent().show();
		} else {
		    $('#gs-other').parent().hide();
		}
	    });

	    Fuse.log("Opening ", this.$popup);

            Fuse.loading( "hide" );
            this.$popup.popup( "open" );
        }
    });
});
