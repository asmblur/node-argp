var argp = require ("./lib");
var utils = require ("utils");

//All operations are synchronous

//argp.nodeDebug it's true if the node process is started in debug mode:
//node debug <script> ...

var opts = argp
		.on ("argument", function (argument){ //argument is a string
			console.log (argument);
			console.log (argp.arguments ()); //Returns an array with all the defined arguments
			//fail() prints a message to stderr and exits. Messages are prefixed like so:
			//<script>: message...
			if (argument === "fail") argp.fail ("fail() test");
		})
		.on ("option", function (option, value){ //option and value are strings; value can be null if it takes an argument and is optional
			console.log (option);
			utils.inspect (argp.options (), { depth: null }); //Returns an array with all the defined options
		})
		.on ("end", function (){
			//Called when all the options and arguments are parsed, just before parse returns
			//This is the place to clean up and prepare information
			console.log ("end");
		})
		.configure ({
			//false: options are parsed first, then the arguments
			//true: options and arguments are parsed in the same order they come
			//Options and arguments can override each other if they have the same name
			inOrder: false, //Default is false
			columns: 80, //Default is 80
			//No error with duplicate options
			undefinedArguments: true, //Allows to write any argument
			undefinedOptions: false, //Does not allow to write undefined options
			//-h, --help and --usage are default options
			//Short and long names can be changed:
			//var arr = argp.options ()
			//arr[arr.length - 2].short = "?"; //help option
			//arr[arr.length - 1].short = "u"; //usage option
			showHelp: true, //Default is true
			showUsage: true //Default is true
		})
		//Adds the option -v, --version
		.version ("v0.0.1")
		//By default, the usage description is:
		//<filename> [OPTIONS...]
		//followed by all the defined arguments surrounded by []:
		//<filename> [OPTIONS...] [arg1] [arg2]
		//With the usage() function it can be changed and add multiple uses:
		//Usage: my-script hack nasa
		//       my-script goto jail
		.usage ("my-script hack nasa")
		.usage ("my-script goto jail")
		.description ("Show some dots on the screen.")
		//Defined arguments
		//Argument definitions can be configured at any time, they don't need to be
		//set before the options
		.argument ("build")
		.argument ("fail")
		//Options and group definitions have an insertion order
		//Options can be grouped
		.group ("Basic options") //Internally it creates a numeric id
		//Defined options
		.option ({
			long: "dot",
			short: "d",
			string: "NUM", //If the string is null it's a flag and "reviver", "value"
										 //and "optional" are ignored and "negate" can be configured
										 //Default is null so all the options are flags by default
										 //Example of flags:
										 //.option({ short: "f1", description: "..." })
										 //.option({ short: "f2", long: "flag2", negate: true }) -> --no-flag2
			description: "Show NUM dots on the screen.", //Default is null
			value: 1, //Default value, default is null
			optional: false, //Default is false
			hidden: false, //Default is false
			reviver: function (value){
				//Transforms the value
				//Useful to parse comma-separated values, dates, etc
				//Default is null
				return value;
			}
		})
		//This group applies to --help, --usage and --version
		.group ("Informational options")
		//Footer information
		.footer ("Bye!")
		//Only one call to parse is allowed, subsequent calls throw an error
		.parse ();

//At this point all the data is ready to be used
//opts.dot
//opts.build
//opts.fail
utils.inspect (opts, { depth: null });