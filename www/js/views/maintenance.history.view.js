define([ "fuse", "jquery", "underscore", "text!templates/maintenancehistorytmpl.html" ], function( Fuse, $, _, maintenanceHistoryTmpl ) {
    return Fuse.View.extend({
        id: "maintenance-history",
        tagName: "div",
        role: "page",
        header: "Fleet History",
        transition: "slide",
        template: _.template( maintenanceHistoryTmpl ),

        initialize: function() {
            Fuse.View.prototype.initialize.apply( this, arguments );
            if ( this.model ) {
                this.header = this.model.get( "nickname" ) + " History";
            }

            this.history = {};
            this.history.items = [];
        },

        render: function() {
            this.history.items.length = 0;
            // Are we rendering history for the whole fleet or just one vehicle?
            if ( this.model ) {
                this.collectVehicleHistory( this.model );
            } else {
                // The whole fleet.
                this.controller.fleet.each(function( vehicle ) {
                    this.collectVehicleHistory( vehicle );
                }, this );
            }

            this.content = this.template({ data: this.history.items });
            Fuse.View.prototype.render.call( this );
        },

        collectVehicleHistory: function( vehicle ) {
            var history = vehicle.get( "history" );

            if ( history !== vehicle.defaults.history ) {
                this.history.items.push({
                    vehicle: vehicle.get( "nickname" ),
                    history: vehicle.get( "history" )
                });
            } else {
                this.history.items.push({
                    vehicle: vehicle.get( "nickname" )
                });
            }
        }
    });
});
