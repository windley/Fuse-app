define(["fuse", "jquery", "underscore", "text!templates/fueltmpl.html"], function(Fuse, $, _, fuelTmpl) {
	// represets an item in the vehicle list.
    return Fuse.View.extend({
        tagName: "div",
        role: "page",
        header: "Fuel Smart",
        transition: "fade",
        template: _.template(fuelTmpl),

        initialize: function() {
            Fuse.View.prototype.initialize.apply(this, arguments);
            this.header = "Smart Fuel";
            this.content = this.template(this.model.toJSON());
        },

        render: function() {
            this.$el.html(this.template(this.model.toJSON()));
            return this;
        }
    });
});