
/* jshint undef: true, unused: true */
/* globals console:false, CloudOS:false  */
/* globals console, setTimeout, CloudOS, API */

(function($)
{
    window['API'] = {

        // development settings.
        VERSION: 0.1,

        defaults: {
            logging: false,  // false to turn off logging
	    production: false,
	    hostsite: "http://windley.github.io/Joinfuse/carvoyant.html" // can't contain ,
        },

	get_rid : function(name) {

	    var rids = {
		"owner": {"prod": "v1_fuse_owner",
			  "dev":  "b16x16"
			 },
		"fleet": {"prod": "v1_fuse_fleet",
			  "dev":  "b16x17"
			 },
		"vehicle": {"prod": "v1_fuse_vehicle",
			    "dev":  "b16x9"
			   },
		"trips": {"prod": "v1_fuse_trips",
			  "dev":  "b16x18"
			 },
		"fuel":  {"prod": "v1_fuse_fuel",
			  "dev":  "b16x20"
			 },
		"maintenance":  {"prod": "v1_maintenance_fuel",
				 "dev":  "b16x21"
				},
		"carvoyant":  {"prod": "v1_fuse_carvoyant",
			       "dev":  "b16x11"
			 },
		"carvoyant_oauth":  {"prod": "v1_fuse_fleet_oauth",
				     "dev":  "b16x23"
				    }
	    };
	    
	    var version = API.fuse_version || (API.defaults.production ? "prod" : "dev");
	    	    
	    return rids[name][version];
	},

	// we'll retrieve the fleet and vehicle ECIs later and put them here...
	fleet_eci: null, 
	vehicles: [],
	vehicle_status: {},
	vehicle_summary: {},
	fuse_version: null,

	check_version: function(cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    if (API.fuse_version === null || options.force) {
                API.log("Checking fuse version");
		return CloudOS.skyCloud("a169x625", "rulesetListChannel", {picoChannel: CloudOS.defaultECI}, function(json) {
		    if(json.rids !== null)  {
			var rids = json.rids;
			API.log("Seeing ruleset list:", rids);
			var found_dev_init = $.inArray("b16x16.prod", rids) >= 0 
                                          || $.inArray("b16x16.dev", rids) >= 0;
			if(found_dev_init) {
			    API.fuse_version = "dev";
			} else {
			    API.fuse_version = "prod";
			}
			cb(API.fuse_version);
			
		    } else {
			console.log("Seeing null ruleset list...using defaults");
			cb(API.defaults.production ? "prod" : "dev");
		    }
		});
	    } else {
		API.log("Using cached value for version ", API.fuse_version);
		cb(API.fuse_version);
		return API.fuse_version;
	    }
	    
	},

	// really ought to put this in CloudOS.js
	select_host: function(cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    if(CloudOS.host == null || options.force) {
		return API.getPreferences(CloudOS.defaultECI, function(json) {
		    var host = API.set_host(json.debugPreference);
		    cb(host);
		});
	    } else {
		API.log("Using cached value for host ", CloudOS.host);
		cb(CloudOS.host);
		return CloudOS.host;
	    }
	},

	set_host: function(debugPreference) {
	    var debug = typeof debugPreference !== "undefined" 
		         && debugPreference === "on";
	    CloudOS.host = debug ? "kibdev.kobj.net" : "cs.kobj.net";
	    console.log("CloudOS Host: ", CloudOS.host);
	    return CloudOS.host;
	},

        init: function(cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    API.log("Initializing...");
	    $.when(
		API.check_version(null, options),
		API.select_host(null, options)
            ).then (
		function(version) { 
		    return API.fleetChannel(); 
		}
	    ).done(function(eci){
		cb();
		API.log("Done initializing...");
	    }).fail(function(res){
		cb();
		console.log("Initialization failed...", res);
	    });
        },

        detect_type: function(o)
        {
            if (typeof o !== "object") return typeof o;

            if (o === null) return "null";

            var internal_class = Object.prototype.toString.call(o).match(/\[object\s(\w+)\]/)[1];
            return internal_class.toLowerCase();
        },

        log: function()
        {
            if (this.defaults.logging && console && console.log) {
		[].unshift.call(arguments, "API:"); // arguments is Array-like, it's not an Array 
                console.log.apply(console, arguments);
            }
        },

	// ---------- profile ----------

	// need to redefine since we're often interested in the profile of another cloud
        getProfile: function(channel, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
            API.log("Retrieving profile for user");

	    return CloudOS.skyCloud("a169x676", "get_all_me", {}, function(res) {
		CloudOS.clean(res);
		if(typeof cb !== "undefined"){
		    cb(res);
		}
	    },
	    {"eci": channel});
        },

        saveProfile: function(channel, json, cb)
        {
            return CloudOS.raiseEvent('pds', 'new_profile_item_available', json, {}, cb, {"eci": channel});
        },

	// ---------- preferences ----------
        getPreferences: function(channel, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
            API.log("Retrieving preferences for user");
	    var attrs = {"setRID": API.get_rid("owner")};
	    return CloudOS.skyCloud("a169x676", "get_setting", attrs, function(res) {
		CloudOS.clean(res);
		res = res.setData; 
		if(typeof cb !== "undefined"){
		    cb(res);
		}
	    },
	    {"eci": channel});
        },
  
        savePreferences: function(channel, json, cb) 
        {
	    var attrs = json;
	    attrs.setRID = API.get_rid("owner");
            return CloudOS.raiseEvent('pds', 'new_settings_available', attrs, {}, cb, {"eci": channel});
        },

	// ---------- account ----------
	// this is called in _layouts/code.html when the account is created
	initAccount: function(attrs, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    attrs = attrs || {};
            API.log("Initializing account for user with attributes ", attrs);

            return CloudOS.raiseEvent("fuse", "bootstrap", attrs, {}, function(response)
            {
		// note that because the channel is create asynchronously, processing callback does
		// NOT mean the channel exists. 
                console.log("account initialized");
		if(response.length < 1) {
		    throw "Account initialization failed";
		}
		// function check(failed){ 
		//     var fc = API.carvoyantOauthUrl() || "";
		//     console.log("Got a URL: ", fc);
		//     if(fc === "" && failed > 0) {
		// 	console.log("Waiting for url ", failed); 
		// 	setTimeout(check, 1000, failed--); // check again in a second
		//     } 
		// };
		// setTimeout(check, 5000, 10); // try 10 times

		function imgTimeout(imgDelay){
		    var fc = API.carvoyantOauthUrl() || "";
		    if (fc !== ""){
			console.log("Got a good response ", fc);
			cb(response);			
		    }
		    else{
			// calls recursively waiting for the img to load
			// increasing the wait time with each call, up to 10
			imgDelay += 1000;
			console.log("Trying with delay ", imgDelay);
			if (imgDelay <= 10000){ // waits up to 20 seconds
			    setTimeout(imgTimeout, imgDelay, imgDelay);
			}
			else{
			    console.log("Never received Carvoyant URL");
			    cb(null);
			}
		    }
		}
		imgTimeout(0);

            });
        },

	// manage account
	picoStatus: function(cb, options) 
	{
	    cb = cb || function(){};
	    options = options || {};
	    var rid = "owner";
	    var eci = options.eci ||  CloudOS.defaultECI;
            API.log("check Pico Status");
	    var args = {};
 	    return CloudOS.skyCloud(API.get_rid(rid), "showPicoStatus", args, function(json) {
		API.log("Seeing pico status ", json);
		cb(json); 
  	    }, {"eci": eci});
	},

	sendReport: function(cb, options) 
	{
	    cb = cb || function(){};
	    options = options || {};
	    var rid = "owner";
	    var eci =  options.eci ||  CloudOS.defaultECI;
            API.log("check Pico Status");
	    var attrs = {};
 	    API.picoStatus(function(json) {
		if(json.status.overall) {
		    return CloudOS.raiseEvent("explicit", "periodic_report", attrs, {}, function(response) {
			API.log("Seeing response status ", response);
			cb(response); 
		    },
                    {"eci": eci
		    });
		} else {
		    console.log("Skipping ", eci, " for status ", json);
		    return {};
		}
	    },
	    {"eci": eci
	    });
	},


	createCarvoyantAccount: function(attrs, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    attrs = attrs || {};
            var fleet_channel = options.fleet_channel || API.fleetChannel();
	    API.log("Creating Carvoyant account for user with attributes ", attrs);

            return CloudOS.raiseEvent("carvoyant", "init_account", attrs, {}, function(response)
            {
                API.log("Carvoyant account created");
		if(response.length < 1) {
		    throw "Carvoyant account creation failed";
		}
		cb(response);
            },
	    {"eci": fleet_channel
	    });
        },

	// codeForToken: function(code, cb, options) 
	// {
	//     cb = cb || function(){};
	//     options = options || {};
        //     API.log("Retrieving access token");
	//     return CloudOS.skyCloud(API.get_rid("owner"), "fleetChannel", {}, function(json) {
	// 	API.fleet_eci = json.cid;
	// 	API.log("Retrieved fleet channel", json);
	// 	cb(json);
	//     });
	// },

	carvoyantOauthUrl: function(cb, options) 
	{
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "carvoyant_oauth";

	    if ( typeof API.carvoyant_oauth_url === "undefined" 
	      || API.carvoyant_oauth_url === "" 
	      || API.carvoyant_oauth_url === null 
              || options.force) {
		API.log("Retrieving Carvoyant OAuth URL");
		return API.ask_fleet("carvoyantOauthUrl", {"hostsite" : API.defaults.hostsite}, API.carvoyant_oauth_url, function(json) {
		    API.carvoyant_oauth_url = json.url;
		    API.log("URL: ", json);
		    cb(json);
  		}, options);
	    } else {
		cb(API.carvoyant_oauth_url);
		return API.carvoyant_oauth_url;
	    }


	},

	isAuthorizedWithCarvoyant: function(cb, options) 
	{
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "carvoyant";
            API.log("Are we authorized with Carvoyant?");
	    return API.ask_fleet("isAuthorized", {}, API.carvoyant, function(json) {
		API.log("Authorized with Carvoyant? ", json);
		API.carvoyant = json;
		cb(json); 
  	    }, options);
	},

	// ---------- manage and use fleet pico ----------
        createFleet: function(attrs, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
            API.log("Creating fleet with attributes ", attrs);
            return CloudOS.raiseEvent("fuse", "need_fleet", attrs, {}, function(response)
            {
		// note that because the channel is create asynchronously, processing callback does
		// NOT mean the channel exists. 
                API.log("Fleet created");
		if(response.length < 1) {
		    throw "Fleet creation failed";
		}
		cb(response);
            });
        },

        deleteFleet: function(cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    var fleet_channel = options.fleet_channel || API.fleetChannel();
	    if(fleet_channel === null ) {
		throw "Fleet ECI is null; can't delete";
	    };
            var attrs = { "fleet_eci": fleet_channel };
            return CloudOS.raiseEvent("fuse", "delete_fleet", attrs, {}, function(response)
            {
                API.log("Fleet deleted with ECI: " + fleet_channel);
		var fleet_channel = API.fleetChannel(function(){}, {"force": true});
		if(response.length < 1) {
		    throw "Fleet deletion failed";
		}
                cb(response);
            });
        },

	fleetChannel: function(cb, options) 
	{
	    cb = cb || function(){};
	    options = options || {};
	    if (typeof API.fleet_eci === "undefined" || API.fleet_eci == "" || API.fleet_eci == null || options.force) {
                API.log("Retrieving fleet channel");
		return CloudOS.skyCloud(API.get_rid("owner"), "fleetChannel", {}, function(json) {
		    if(json.eci != null)  {
			API.fleet_eci = json.eci;
			API.log("Retrieved fleet channel", json);
			cb(json.eci);
		    } else {
			console.log("Seeing null fleet eci, not storing...");
			cb(null);
		    }
		});
	    } else {
		API.log("Using cached value of fleet channel ", API.fleet_eci);
		cb(API.fleet_eci);
		return API.fleet_eci;
	    }
	},

	ask_fleet: function(funcName, args, cache, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    var rid = options.rid || "fleet";
	    // if (typeof cache === "undefined" 
	    //   || cache === "" 
	    //   || cache === null
	    //   || (typeof cache === "object" && typeof cache.length === "number" && cache.length < 1)
	    //   || options.force
	    //    ) {
	    if (isEmpty(cache)
	      || options.force
	       ) {
                   API.log("Calling " + funcName);
		   API.fleetChannel(function(fc) {
		       API.log("Using fleet channel ", fc);
   		       if(fc !== "none") {
			   return CloudOS.skyCloud(API.get_rid(rid), funcName, args, cb, {"eci": fc});
		       } else {
			   API.log("fleet_eci is undefined, you must get the fleet channel first");
			   return null;
		       }
		   });
	       } else {
		   cb(cache);
		   return cache;
	       }
	}, 

	// tells the fleet to broadcast access tokens to the vehicles. 
	// should be done any time the access token is refreshed or a new vehicle is added
	configureVehicles: function(config, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    var fleet_channel = options.fleet_channel || API.fleetChannel();
	    if(fleet_channel === null ) {
		throw "Fleet channel is null; can't configure vehicles";
	    };
	    var attrs = config;
            return CloudOS.raiseEvent("fuse", "config_outdated", attrs, {}, function(response)
            {
                API.log("Updated vehicle configurations");
		if(response.length < 1) {
		    throw "Vehicle configuration failed";
		}
                cb(response);
            },
	    {"eci": fleet_channel
	    } 
            );
        },



	vehicleChannels: function(cb, options){
	    cb = cb || function(){};
	    options = options || {};
            API.log("Retrieving vehicles");
	    return API.ask_fleet("vehicleChannels", {}, API.vehicles, function(json) {
		if(typeof json.error === "undefined") {
		    API.vehicles = json;
		    API.log("Retrieved vehicles", json);
		    cb(json);
		} else {
		    console.log("Bad vehicle channel fetch: ", json);
		}
  		}, options);
	},

	vehicleStatus: function(cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    return API.ask_fleet("vehicleStatus", {}, API.vehicle_status, function(json) {
		if(typeof json.error === "undefined") {
		    API.vehicle_status = json;
		    API.log("Retrieve vehicle status", json);
		    cb(json);
		} else {
		    console.log("Bad vehicle status fetch: ", json);
		}
  	    }, options);
	},

	vehicleSummary: function(cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    if(isEmpty(API.vehicle_summary)) {
		options.force = true;
	    }
	    return API.ask_fleet("vehicleSummary", {}, API.vehicle_summary, function(json) {
		if(typeof json.error === "undefined") {
			API.vehicle_summary = json;
			API.log("Retrieve vehicle summary", json);
			cb(json);
		} else {
		    console.log("Bad vehicle summary fetch ", json);
		}
  	    }, options);
	},

	tripSummaries: function(year, month, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    API.trip_summary = API.trip_summary || {};
	    API.trip_summary[year] = API.trip_summary[year] || {};
	    if(isEmpty(API.vehicle_summary)) {
		options.force = true;
	    }
	    var ts_cache = (typeof API.trip_summary[year] !== "undefined") ? API.trip_summary[year][month]
                                                                            : null; 
	    var args = {"month": month,
			"year": year
		       };
	    return API.ask_fleet("tripSummaries", args, ts_cache, function(json) {
		if(typeof json.error === "undefined") {
			API.trip_summary[year][month] = json;
			API.log("Retrieve trip summaries", json);
			cb(json);
		} else {
		    console.log("Bad trip summaries fetch ", json);
		}
  	    }, options);
	},

	fuelSummaries: function(year, month, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    API.fuel_summary = API.fuel_summary || {};
	    API.fuel_summary[year] = API.fuel_summary[year] || {};
	    if(isEmpty(API.vehicle_summary)) {
		options.force = true;
	    }
	    var ts_cache = (typeof API.fuel_summary[year] !== "undefined") ? API.fuel_summary[year][month]
                                                                            : null; 
	    var args = {"month": month,
			"year": year
		       };
	    return API.ask_fleet("fuelSummaries", args, ts_cache, function(json) {
		if(typeof json.error === "undefined") {
			API.fuel_summary[year][month] = json;
			API.log("Retrieve fuel summaries", json);
			cb(json);
		} else {
		    console.log("Bad fuel summaries fetch ", json);
		}
  	    }, options); 
	},

	updateVehicleSummary: function(id, profile) {
	    API.vehicle_summary = API.vehicle_summary || [];

	    // prepare new object for saving
	    var p = jQuery.extend({}, profile);
	    delete p.myProfileName;
	    delete p.myProfilePhoto;
	    p.profileName = profile.myProfileName;
	    p.profilePhoto = profile.myProfilePhoto;
	    p.picoId = id;

	    console.log("Updating profile with ", p);

	    // save it or push it, if not foundf
	    var elementPos = API.vehicle_summary.map(function(x) {return x.picoId; }).indexOf(id);
	    if (elementPos < 0) {
		API.vehicle_summary.push(p);
	    } else {
		p.vehicleId = API.vehicle_summary[elementPos].vehicleId;
		p.lastRunningTimestamp = API.vehicle_summary[elementPos].lastRunningTimestamp;
		p.lastWaypoint = API.vehicle_summary[elementPos].lastWaypoint; 
		p.address = API.vehicle_summary[elementPos].address;
		p.fuellevel = API.vehicle_summary[elementPos].fuellevel;
		API.vehicle_summary[elementPos] = p;
	    }
	},

	invalidateVehicleSummary: function() {
	    API.vehicle_summary = null;
	},

	// ---------- manage and use vehicle picos ----------
        createVehicle: function(name, photo_url, vin, deviceId, mileage, cb, options)
        {
	    cb = cb || function(){}; // prophilaxis
	    options = options || {};
	    var json = {"name": name,
			"photo": photo_url,
			"vin": vin,
			"mileage": mileage,
			"deviceId": deviceId
		       };
	    if(typeof options.license === "string") {
		json.license = options.license;
	    }
	    API.fleetChannel(function(fleet_channel) {
		if(fleet_channel === null ) {
		    throw "Fleet channel is null; can't add vehicle";
		};
		API.log("Creating vehicle with attributes ", json);
		return CloudOS.raiseEvent("fuse", "need_new_vehicle", json, {}, function(response)
			{
			    // note that because the channel is create asynchronously, processing callback does
			    // NOT mean the channel exists. 
			    API.log("Vehicle added with directives", response);
			    cb(response);
			},
			{"eci": fleet_channel
			}
		      );
		});
        },

        deleteVehicle: function(vehicle_name, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    API.fleetChannel(function(fleet_channel){
		if(fleet_channel === null ) {
		    throw "Fleet channel is null; can't delete vehicle";
		};
		if(typeof vehicle_name === "undefined" || vehicle_name === null ) {
		    throw "Vehicle channel is null; can't delete vehicle";
		};
		var attrs = { "vehicle_name": vehicle_name };
		return CloudOS.raiseEvent("fuse", "delete_vehicle", attrs, {}, function(response)
					  {
					      API.log("Fleet deleted with ECI: " + fleet_channel);
					      API.vehicles = []; // reset so that the next call to vehicleChannels() is forced to update
					      // remove from vehicle_summary
					      delete API.vehicle_summary[vehicle_name];
					      if(response.length < 1) {
						  throw "Vehicle deletion failed";
					      }
					      cb(response);
					  },
					  {"eci": fleet_channel
					  } 
					 );
	    });
        },

	initializeVehicle: function(vehicle_channel, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't initialize vehicle";
	    };
	    var attrs = {};
            return CloudOS.raiseEvent("fuse", "vehicle_uninitialized", attrs, {}, function(response)
            {
                API.log("Initialized vehicle for: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Vehicle initialization failed";
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	initCarvoyantVehicle: function(vehicle_channel, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't update Carvoyant account for vehicle";
	    };
	    var attrs = {"label": options.label,
			 "mileage": options.mileage
			};

            return CloudOS.raiseEvent("carvoyant", "init_vehicle", attrs, {}, function(response)
            {
                API.log("Initialized carvoyant account for vehicle: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Vehicle initialization failed";
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },


	updateCarvoyantVehicle: function(vehicle_channel, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't update Carvoyant account for vehicle";
	    };
	    var attrs = {"label": options.label,
			 "mileage": options.mileage,
			 "deviceId": options.deviceId
			};

            return CloudOS.raiseEvent("carvoyant", "init_vehicle", attrs, {}, function(response)
            {
                API.log("Updated carvoyant account for  vehicle: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Vehicle initialization failed";
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	currentVehicleStatus: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "carvoyant";
	    
	    var args = {};

	    return API.ask_vehicle(vehicle_channel, "vehicleStatus", args, null, function(json) {
			API.log("Retrieve current vehicle status", json);
			cb(json);
  		       }, options);
	},

	updateVehicleDataCarvoyant: function(vehicle_channel, data_type, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    var event_map = {"summary" : {"event" : "need_vehicle_data",
					  "attributes": []},
			     "status" : {"event":"need_vehicle_status",
					  "attributes": []},
			     "trip": {"event": "new_trip",
				      "attributes": ["tripId"]}
			    };
	    
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't update vehicle";
	    };
	    var attrs = {};
	    $.each(event_map[data_type].attributes,function(i,v){
		attrs[v] = options[v];
	    });
            return CloudOS.raiseEvent("fuse", event_map[data_type].event,  attrs, {}, function(response)
            {
                API.log("Updated vehicle data for: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Vehicle update failed";
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	ask_vehicle: function(vehicle_channel, funcName, args, cache, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    cache = cache || {};
	    var rid = options.rid || "vehicle";
	    if (typeof cache[vehicle_channel] === "undefined" 
	      || cache[vehicle_channel] === "" 
	      || cache[vehicle_channel] === null
	      || (typeof cache[vehicle_channel] === "object" && typeof cache[vehicle_channel].length === "number" && cache[vehicle_channel].length < 1)
	      || options.force
	       ) {
                API.log("Calling " + funcName);
		if(vehicle_channel !== "none") {
		    return CloudOS.skyCloud(API.get_rid(rid), funcName, args, cb, {"eci": vehicle_channel});
		} else {
		    API.log("vehicle_channel is undefined, you must get the vehicle channel first");
		    return null;
		}
	    } else {
		API.log("Using cached ")
		cb(cache[vehicle_channel]);
		return cache[vehicle_channel]
	    }
	},


	// ---------- Fuel ----------
	fillups: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "fuel";
	    
	    var args = options.id ? {"id": options.id} : {};

	    return API.ask_vehicle(vehicle_channel, "fillups", args, null, function(json) {
			API.log("Retrieve last fillup", json);
			cb(json);
  		       }, options);
	},

	fillupsByDate: function(vehicle_channel, start, end, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "fuel";
	    
	    var args = {"start": start,
			"end": end
		       };

	    return API.ask_vehicle(vehicle_channel, "fillupsByDate", args, null, function(json) {
			API.log("Retrieve fillups", json);
			cb(json);
  		       }, options);
	},


	recordFillup: function(vehicle_channel, fillup_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record fuel fillup for vehicle";
	    };
	    API.requireParams({volume: fillup_obj.volume,
				unitPrice: fillup_obj.unitPrice,
				odometer: fillup_obj.odometer
			       });

            return CloudOS.raiseEvent("fuse", "new_fuel_purchase", fillup_obj, {}, function(response)
				      {
					  API.log("Recorded fillup for vehicle: " + vehicle_channel);
					  if(response.length < 2) {
					      throw "Fuel fillup record failed for vehicle: "  + vehicle_channel;
					  }
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	updateFillup: function(vehicle_channel, fillup_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record fuel fillup for vehicle";
	    };
	    API.requireParams({volume: fillup_obj.volume,
				unitPrice: fillup_obj.unitPrice,
				odometer: fillup_obj.odometer,
				id: fillup_obj.id
			       });

            return CloudOS.raiseEvent("fuse", "updated_fuel_purchase", fillup_obj, {}, function(response)
				      {
					  API.log("Updateded fillup for vehicle: " + vehicle_channel);
					  if(response.length < 1) {
					      throw "Fuel fillup update failed for vehicle: "  + vehicle_channel;
					  }
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	deleteFillup: function(vehicle_channel, id, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record fuel fillup for vehicle";
	    };
	    API.requireParams({id: id});

	    var attrs = {"id": id};
            return CloudOS.raiseEvent("fuse", "unneeded_fuel_purchase", attrs, {}, function(response)
            {
                API.log("Deleted fillup for vehicle: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Fuel fillup record delete failed for vehicle: "  + vehicle_channel;
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	// ---------- trips ----------
	lastTrip: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "trips";
	    
	    API.last_trip = API.last_trip || {};

	    var args = {};

	    return API.ask_vehicle(vehicle_channel, "lastTrip", args, API.last_trip, function(json) {
			API.last_trip[vehicle_channel] = json;
			API.log("Retrieve last trip", json);
			cb(json);
  		       }, options);
	},

	trips: function(vehicle_channel, id, limit, offset, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "trips";
	    
	    var args = {"id": id,
			"limit": limit,
			"offset": offset
		       };

	    return API.ask_vehicle(vehicle_channel, "trips", args, null, function(json) {
			API.log("Retrieve trips", json);
			cb(json);
  		       }, options);
	},

	tripsByDate: function(vehicle_channel, start, end, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "trips";
	    
	    var args = {"start": start,
			"end": end
		       };

	    return API.ask_vehicle(vehicle_channel, "tripsByDate", args, null, function(json) {
			API.log("Retrieve trips", json);
			cb(json);
  		       }, options);
	},

	icalSubscriptionUrl: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "trips";
	    
	    var args = {};

	    return API.ask_vehicle(vehicle_channel, "icalSubscriptionUrl", args, null, function(json) {
			API.log("iCal subscription URL: ", json);
			cb(json);
  		       }, options);
	},
	
	updateTrip: function(vehicle_channel, trip_id, trip_name, trip_category, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't update trip for vehicle";
	    };
	    if( typeof trip_id === "undefined" 
	      ){
		throw "Bad data; Trip ID is required: ";
	    }

	    var attrs  = {"tripId": trip_id,
		          "tripName": trip_name,
			  "tripCategory" : trip_category
			 };
            return CloudOS.raiseEvent("fuse", "trip_meta_data", attrs, {}, function(response)
            {
                API.log("Updated trip for vehicle: " + vehicle_channel + " with ", attrs);
		if(response.length < 1) {
		    throw "Updating trip (" + trip_id + ") failed for vehicle: "  + vehicle_channel;
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
	},


	// ---------- subscriptions to device events ----------
	vehicleSubscriptions: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "vehicle";
	    
	    API.last_trip = API.last_trip || {};

	    var args = {};
	    if(typeof options.subscription_type !== "undefined") {
		args.subscription_type = options.subscription_type;
	    }
	    if(typeof options.subscription_id !== "undefined") {
		args.subscription_id = options.subscription_id;
	    }

	    return API.ask_vehicle(vehicle_channel, "vehicleSubscription", args, {}, function(json) {
			API.log("Retrieve vehicle subscriptions", json);
			cb(json);
  		       }, options);
	},

	addSubscription: function(vehicle_channel, subscription_type, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't add subscription for vehicle";
	    };
	    if( typeof subscription_type === "undefined" 
	      ){
		throw "Bad data; invalid subscription type: ", subscription_typej;
	    }

	    var attrs  = {"subscription_type": subscription_type,
			  "idempotent" : options.idempotent
			 };
            return CloudOS.raiseEvent("carvoyant", "new_subscription_needed", attrs, {}, function(response)
            {
                API.log("Added new subscription ("+ subscription_type + ") for vehicle: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Adding subscription (" + subscription_type + ") failed for vehicle: "  + vehicle_channel;
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	deleteSubscription: function(vehicle_channel, subscription_type, subscription_id, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't delete subscription for vehicle";
	    };
	    if( typeof subscription_type === "undefined" 
             || typeof subscription_id === "undefined" 
	      ){
		throw "Bad params; subscription_type: " + subscription_type + ", subscription_id: " + subscription_id;
	    }
	    var attrs = {"subscription_type": subscription_type,
			 "subscription_id": subscription_id
			};
            return CloudOS.raiseEvent("fuse", "subscription_not_needed", attrs, {}, function(response)
            {
                API.log("Deleted subscription (" + subscription_type +  ", " + subscription_id + ") for vehicle: " + vehicle_channel);
		if(response.length < 1) {
		    throw "Subscription delete failed (" + subscription_type +  ", " + subscription_id + ") for vehicle: " + vehicle_channel;
		}
                cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	requireParams: function(params) {

	    if( typeof params === "undefined") {
		throw "Data data; undefined params";
	    }

	    $.each(params, function(k, v){
		if(typeof v === "undefined" || v === null ) {
		    throw "Data data; parameter undefined: " + k;
		};
	    });
	},

	// ---------- Reminders ----------
	reminders: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "maintenance";
	    
	    var args = options; // use them all...

	    return API.ask_vehicle(vehicle_channel, "reminders", args, null, function(json) {
			API.log("Retrieve last reminder", json);
			cb(json);
  		       }, options);
	},

	activeReminders: function(vehicle_channel, date, mileage, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "maintenance";
	    
	    var args = {"current_time": date,
			"mileage": mileage
		       };

	    return API.ask_vehicle(vehicle_channel, "activeReminders", args, null, function(json) {
			API.log("Retrieve active reminders", json);
			cb(json);
  		       }, options);
	},

	recordReminder: function(vehicle_channel, reminder_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record reminder for vehicle";
	    };
	 

            return CloudOS.raiseEvent("fuse", "new_reminder", reminder_obj, {}, function(response)
				      {
					  if(response.length < 2) {
					      throw "Reminder record failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Recorded reminder for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	updateReminder: function(vehicle_channel, reminder_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record reminder for vehicle";
	    };
	    API.requireParams({id: reminder_obj.id
			       });

            return CloudOS.raiseEvent("fuse", "updated_reminder", reminder_obj, {}, function(response)
				      {
					  if(response.length < 1) {
					      throw "Reminder update failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Updated reminder for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	deleteReminder: function(vehicle_channel, id, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record reminder for vehicle";
	    };
	    API.requireParams({id: id});

	    var attrs = {"id": id};
            return CloudOS.raiseEvent("fuse", "unneeded_reminder", attrs, {}, function(response)
            {
		if(response.length < 1) {
		    throw "Reminder delete failed for vehicle: "  + vehicle_channel;
		} 
                API.log("Deleted reminder for vehicle: " + vehicle_channel);
		cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	
	// ---------- Alerts ----------
	alerts: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "maintenance";
	    
	    var args = options; // use them all...

	    return API.ask_vehicle(vehicle_channel, "alerts", args, null, function(json) {
			API.log("Retrieve last alert", json);
			cb(json);
  		       }, options);
	},

	alertsByDate: function(vehicle_channel, start, end, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "maintenance";
	    
	    var args = {"start": start,
			"end": end
		       };

	    if(typeof options.status !== "undefined") {
		args.status = options.status;
	    }

	    return API.ask_vehicle(vehicle_channel, "alertsByDate", args, null, function(json) {
			API.log("Retrieve alerts", json);
			cb(json);
  		       }, options);
	},


	recordAlert: function(vehicle_channel, alert_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record alert for vehicle";
	    };
	 

            return CloudOS.raiseEvent("fuse", "new_alert", alert_obj, {}, function(response)
				      {
					  if(response.length < 2) {
					      throw "Alert record failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Recorded alert for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	updateAlert: function(vehicle_channel, alert_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record alert for vehicle";
	    };
	    API.requireParams({id: alert_obj.id
			       });

            return CloudOS.raiseEvent("fuse", "updated_alert", alert_obj, {}, function(response)
				      {
					  if(response.length < 1) {
					      throw "Alert update failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Updated alert for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	deleteAlert: function(vehicle_channel, id, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record alert for vehicle";
	    };
	    API.requireParams({id: id});

	    var attrs = {"id": id};
            return CloudOS.raiseEvent("fuse", "unneeded_alert", attrs, {}, function(response)
            {
		if(response.length < 1) {
		    throw "Alert delete failed for vehicle: "  + vehicle_channel;
		} 
                API.log("Deleted alert for vehicle: " + vehicle_channel);
		cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },

	processAlert: function(vehicle_channel, status_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record alert for vehicle";
	    };
	    API.requireParams({id: status_obj.id,
				status: status_obj.status
			       });

            return CloudOS.raiseEvent("fuse", "handled_alert", status_obj, {}, function(response)
				      {
					  if(response.length < 1) {
					      throw "Alert processing failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Handled alert for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	updateAlertStatus: function(vehicle_channel, id, new_status, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record alert for vehicle";
	    };
	    var attrs = {id: id,
			 status: new_status
			};
	    API.requireParams(attrs); // require all
            return CloudOS.raiseEvent("fuse", "new_alert_status", attrs, {}, function(response)
				      {
					  if(response.length < 1) {
					      throw "Alert status update failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Updated alert status for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);

				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	// ---------- maintenance records ----------
	maintenanceRecords: function(vehicle_channel, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "maintenance";
	    var args = options; // use them all...

	    return API.ask_vehicle(vehicle_channel, "maintenanceRecords", args, null, function(json) {
			API.log("Retrieve maintenance records", json);
			cb(json);
  		       }, options);
	},

	maintenanceRecordsByDate: function(vehicle_channel, start, end, cb, options) {
	    cb = cb || function(){};
	    options = options || {};
	    options.rid = "maintenance";
	    
	    var args = {"start": start,
			"end": end
		       };
	    if(typeof options.status !== "undefined") {
		args.status = options.status;
	    }
	    return API.ask_vehicle(vehicle_channel, "maintenanceRecordsByDate", args, null, function(json) {
			API.log("Retrieve maintenance records", json);
			cb(json);
  		       }, options);
	},


	recordMaintenanceRecord: function(vehicle_channel, maintenance_record_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record maintenance_record for vehicle";
	    };
	 

            return CloudOS.raiseEvent("fuse", "new_maintenance_record", maintenance_record_obj, {}, function(response)
				      {
					  if(response.length < 1) {
					      throw "Maintenance record record failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Recorded maintenance record for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	updateMaintenanceRecord: function(vehicle_channel, maintenance_record_obj, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record maintenance_record for vehicle";
	    };
	    API.requireParams({id: maintenance_record_obj.id
			       });

            return CloudOS.raiseEvent("fuse", "updated_maintenance_record", maintenance_record_obj, {}, function(response)
				      {
					  if(response.length < 1) {
					      throw "Maintenance record update failed for vehicle: "  + vehicle_channel;
					  }
					  API.log("Updated maintenance record for vehicle: " + vehicle_channel + ": " + response);
					  cb(response);
				      },
				      {"eci": vehicle_channel
				      } 
            );
        },

	deleteMaintenanceRecord: function(vehicle_channel, id, cb, options)
        {
	    cb = cb || function(){};
	    options = options || {};
	    if(typeof vehicle_channel === "undefined" || vehicle_channel === null ) {
		throw "Vehicle channel is null; can't record maintenance_record for vehicle";
	    };
	    var attrs = {"id": id};
	    API.requireParams(attrs); // require all

            return CloudOS.raiseEvent("fuse", "unneeded_maintenance_record", attrs, {}, function(response)
            {
		if(response.length < 1) {
		    throw "Maintenance Record delete failed for vehicle: "  + vehicle_channel;
		} 
                API.log("Deleted maintenance record for vehicle: " + vehicle_channel);
		cb(response);
            },
	    {"eci": vehicle_channel
	    } 
            );
        },


    };

    function isEmpty(obj) {

	// null and undefined are "empty"
	if (obj == null) return true;

	if( typeof obj === "number" 
	 || typeof obj === "string" 
	 || typeof obj === "boolean" 	
	  ) return false;

	// Assume if it has a length property with a non-zero value
	// that that property is correct.
	if (obj.length > 0)    return false;
	if (obj.length === 0)  return true;

	// Otherwise, does it have any properties of its own?
	// Note that this doesn't handle
	// toString and valueOf enumeration bugs in IE < 9
	for (var key in obj) {
            if (hasOwnProperty.call(obj, key)) return false;
	}

	return true;


    };


})(jQuery);


