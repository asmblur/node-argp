var argp = require ("./lib");
var util = require ("util");

var opts = argp
		.on ("argument", function (obj, argument){
			console.log (argument);
		})
		.on ("option", function (obj, option, value){
			console.log (option);
		})
		.on ("end", function (obj){
			console.log ("end");
		})
		.configure ({
			//undefinedOptions: true
		})
		.option ({ long: "a", argument: "N", optional: false })
		.parse ();
		
//console.log (util.inspect (opts, { depth: null }));