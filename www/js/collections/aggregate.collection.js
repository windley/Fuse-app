define([ "fuse", "models/aggregate.model" ], function( Fuse, Aggregate ) {
    return Fuse.Collection.extend({
        model: Aggregate,

        initialize: function(models, options) {
            this.type = options.type;
        },

        sync: function(method, model, options) {
            switch(method) {
                case 'read':
                    var now = new Date();
                    Fuse.loading('show', 'fetching ' + this.type + ' summaries');
                    API[this.type + 'Summaries'](

                        now.getFullYear(),

                        '0' + (now.getMonth() + 1),

                        function(res) {
                            Fuse.loading('hide');
                            if (typeof res.skyCloudError === 'undefined') {
                                if (typeof options.success === 'function') {
                                    options.success();
                                }
                            } else {
                                if (typeof options.error === 'function') {
                                    options.error();
                                }
                            }
                        },

                        {
                            force: true
                        }
                    );
                    break;
                default:
                    options.error('API method not yet implemented');
                    break;
            }
        }
    });
});