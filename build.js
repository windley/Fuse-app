({    
    baseUrl: "js",
    out: "build/fuse.js",
    include: ["main"],
    paths: {
        "jquery": "vendor/jquery-1.11.0.min",
        "jquerymobile": "vendor/jquery.mobile-1.4.0.min",
        "jquerymobileconfig": "vendor/jquery.mobile.config",
        "cloudos": "vendor/CloudOS",
        "cloudosconfig": "vendor/CloudOS.config",
        "underscore": "vendor/underscore-min",
        "text": "vendor/require.text",
        "backbone": "vendor/backbone-min"
    },

    shim: {
        "underscore": {
            exports: "_"
        },
        "jquerymobileconfig": ["jquery"],
        "jquerymobile": ["jquery", "jquerymobileconfig"],
        "cloudosconfig": ["jquery"],
        "cloudos": {
            deps: ["jquery", "cloudosconfig"],
            exports: "CloudOS"
        },
        "backbone": {
            deps: ["underscore", "jquery"],
            exports: "Backbone"
        }
    }
})
