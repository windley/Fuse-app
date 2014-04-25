define([ "fuse", "jquery", "underscore", "text!templates/maintenancereminderstmpl.html" ], function( Fuse, $, _, maintenanceRemindersTmpl ) {
    return Fuse.View.extend({
        id: "maintenance-reminders",
        tagName: "div",
        role: "page",
        header: "Fleet Reminders",
        transition: "slide",
        template: _.template( maintenanceRemindersTmpl ),
        
        events: {
            "tap #create-reminder"          : "showCreateReminderForm",
            "change #reminder-trigger-type" : "showRequestedTriggerType",
            "submit #reminder"              : "scheduleMaintenanceReminder"
        },

        initialize: function() {
            Fuse.View.prototype.initialize.apply( this, arguments );
            if ( this.model ) {
                this.header = this.model.get( "nickname" ) + " Reminders";
            }
            this.reminders = [];
        },

        render: function() {
            // Handle re-renders correctly.
            this.reminders.length = 0;

            // Are we rendering reminders for the whole fleet or just one vehicle?
            if ( this.model ) {
                this.collectVehicleReminders( this.model );
            } else {
                // The whole fleet.
                this.controller.fleet.each(function( vehicle ) {
                    this.collectVehicleReminders( vehicle );
                }, this );
            }

            this.content = this.template({ data: this.reminders });
            Fuse.View.prototype.render.call( this );

            this.$reminderFormPopup = $( "#reminder-form" );

            /**
             * Set the initial state of some input elements to hidden.
             * We have to do it here because jQuery Mobile is stupid.
             * Ok, that's a horrible explanation. We have to do it here
             * because jQuery mobile applies its custom styling in such
             * a way that setting display to none on an element in it's
             * initial state is pointless. So we have to hide them after
             * the fact.
             *
             * Note: jQuery Mobile actually wraps input elements with a
             *       custom wrapper div so it can add more custom styling
             *       and properties to them. So we actually end up having
             *       the input element's container.
             */
            this.$triggerDateInputContainer = $( "#reminder-trigger-date" ).parent();
            this.$triggerMileageInputContainer = $( "#reminder-trigger-mileage" ).parent();
            this.$triggerDateInputContainer.hide();
            this.$triggerMileageInputContainer.hide();
        },

        collectVehicleReminders: function( vehicle ) {
            var reminders = vehicle.get( "reminders" );

            if ( reminders !== vehicle.defaults.reminders ) {
                this.reminders.push({
                    vehicle: vehicle.get( "nickname" ),
                    reminders: vehicle.get( "reminders" )
                });
            } else {
                this.reminders.push({
                    vehicle: vehicle.get( "nickname" )
                });
            }
        },

        showCreateReminderForm: function( e ) {
            this.$reminderFormPopup.popup( "open" );
            this.$triggerDateInputContainer.show();
            e.handled = true;
        },

        showRequestedTriggerType: function( e ) {
            var $typeSelect = $( e.target ),
                type = $typeSelect.val();

            switch ( type ) {
                case "mileage":
                    this.$triggerDateInputContainer.hide();
                    this.$triggerMileageInputContainer.show();
                    break;
                case "date":
                    this.$triggerMileageInputContainer.hide();
                    this.$triggerDateInputContainer.show();
                    break;
                default:
                    break;
            }

            e.handled = true;
        },

        scheduleMaintenanceReminder: function( e ) {
            e.preventDefault();
            e.stopPropagation();

            var data = $( e.target ).serializeObject(),
                reminder = {
                    reason: data.reason,
                    trigger: {
                        type: data.type,
                        value: ( data.mileage ) ? data.mileage : data.date
                    }
                };
            
            Fuse.log( reminder );
            this.$reminderFormPopup.popup( "close" );
            alert( "Success! Reminder saved." );

            e.handled = true;
        }
    });
});