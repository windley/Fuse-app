define([ "fuse", "jquery", "underscore" ], function( Fuse, $, _ ) {
    return Fuse.View.extend({
        tagName: "div",
        id: "find-car",
        contentClass: "fuse-map-container",
        header: "Find Car",
        role: "page",
        transition: "slide",

        initialize: function( options ) {
            Fuse.View.prototype.initialize.apply( this, arguments );

            this.map = {
                container: "#find-car > .fuse-content",
                overlays: []
            };

            this.collection.each(function(vehicle, idx) {
                var icon = "style/images/car_map_icon_"+ idx % 3 +".png";
                this.map.overlays.push({
                    icon: icon,
                    type: Fuse.map.OverlayTypeId.MARKER,
                    position: vehicle.get("lastWaypoint"),
                    title: vehicle.get("nickname"),
                    animation: "drop",
                    route: "click"
                });
            }, this);
        },
        
        render: function() {
            Fuse.View.prototype.render.apply( this, arguments );
        }
    });
});