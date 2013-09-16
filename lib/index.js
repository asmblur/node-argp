"use strict";

var events = require ("events");
var util = require ("util");
var path = require ("path");
var wrap = require ("./wrap");
var ArgpError = require ("./error");

var cast = function (value){
	if (value === "undefined") return undefined;
	if (value === "null") return null;
	if (value === "true") return true;
	if (value === "false") return false;
	var v = Number (value);
	return isNaN (v) ? value : v;
};

var Argp = function (){
	events.EventEmitter.call (this);
	
	this._debug = process.argv[1] === "debug";
	this._filename = this._debug
			? path.resolve (process.argv[2])
			: process.argv[1];
	this._configuration = {
		allowUndefinedOptions: true,
		allowUndefinedArguments: true,
		sort: false,
		columns: 80,
		showHelp: false,
		showUsage: false
	};
	this._description = null;
	this._version = null;
	this._email = null;
	this._footer = null;
	this._next = 0;
	this._emitArguments = false;
	this._arguments = {};
	this._argumentsArray = [];
	this._options = {};
	this._lines = [];
	this._optionsShort = {};
	this._optionsLong = {};
	this._usages = [];
	this._argv = null;
	this._script = this._debug
			? process.argv[2]
			: path.basename (process.argv[1]);
	this._ignore = false;
	var me = this;
	this._ignoreFn = function (){
		me._ignore = true;
	};
};

util.inherits (Argp, events.EventEmitter);

Argp.prototype._free = function (){
	this._debug = this._filename = this._debug = this._configuration =
			this._description = this._version = this._email = this._next =
			this._emitArguments = this._arguments = this._argumentsArray =
			this._options = this._lines = this._optionsShort =
			this._optionsLong = this._usages = this._script = this._ignore =
			this._ignoreFn = null;
};

Argp.prototype._errorTry = function (){
	var c = this._configuration;
	
	if (!c.showHelp && !c.showUsage) return;
	
	var str;
	if (c.showHelp && c.showUsage){
		str = "'" + this._script + " --help' or '" + this._script + " --usage'";
	}else if (c.showHelp && !c.showUsage){
		str = "'" + this._script + " --help'";
	}else{
		str = "'" + this._script + " --usage'";
	}
	
	console.error ("Try " + str + " for more information.");
};

Argp.prototype._errorConvert = function (name, type){
	console.error (this._script + ": Option '" + name + "' is not a " + type +
			".");
	this._errorTry ();
	process.exit (1);
};

Argp.prototype._errorAbbreviation = function (name){
	console.error (this._script + ": Option '" + name + "' is ambiguous.");
	this._errorTry ();
	process.exit (1);
};

Argp.prototype._errorNotExpectedValue = function (name){
	this._errorExpectedValue (name, "not");
};

Argp.prototype._errorExpectedValue = function (name, negate){
	console.error (this._script + ": Option '" + name + "' " +
			(negate ? "does not require" : "requires") + " an argument.");
	this._errorTry ();
	process.exit (1);
};

Argp.prototype._errorUnrecognized = function (str, name){
	console.error (this._script + ": Unrecognized " + str + " '" + name + "'.");
	this._errorTry ();
	process.exit (1);
};

Argp.prototype._errorUnrecognizedOption = function (name){
	this._errorUnrecognized ("option", name);
};

Argp.prototype._errorUnrecognizedArgument = function (name){
	this._errorUnrecognized ("argument", name);
};

Argp.prototype._printHelp = function (){
	var h = "";
	
	//Cannot use this._lines because arguments, group and text lines are
	//also pushed into this array
	if (Object.keys (this._options).length){
		h += " [OPTIONS]";
	}
	
	var prefix = "         ";
	var c = this._configuration.columns;
	
	if (this._usages.length){
		var s = "";
		for (var i=0, ii=this._usages.length; i<ii; i++){
			s += (i ? "\n       " : "") + wrap ((i ? "" : "Usage: ") +
					this._script + h + " " + this._usages[i], i ? c - 7 : c, prefix);
		}
		h = s;
	}else{
		if (Object.keys (this._arguments).length){
			h += " [ARGUMENTS]";
		}
		h = wrap ("Usage: " + this._script + h, c, prefix);
	}
	
	if (this._description) h += "\n\n" + wrap (this._description, c);
	
	var previousGroup;
	var previousArgument;
	var previousLine;
	var me = this;
	
	this._lines.forEach (function (o){
		if (o.text){
			h += "\n\n" + wrap (o.text, c);
			previousGroup = false;
			previousLine = false;
			previousArgument = false;
			return;
		}
		
		if (o.group){
			h += "\n\n " + wrap (o.group + ":", c, " ");
			previousGroup = true;
			previousLine = false;
			previousArgument = false;
			return;
		}
		
		var line = "  ";
		
		if (o.arg){
			var name = o.arg;
			o = me._arguments[o.arg];
			if (o.hidden) return;
			
			h += (previousGroup || previousArgument ? "\n" : "\n\n");
			line += name;
			previousLine = false;
			previousArgument = true;
		}else{
			if (o.hidden) return;
			h += (previousGroup || previousLine ? "\n" : "\n\n");
			previousLine = true;
			previousArgument = false;
			
			if (o.short){
				if (o.long){
					line += "-" + o.short + ", --" +
							(o.flag && o.negate ? "no-" + o.long : o.long);
					if (!o.flag){
						line += (o.optional ? "[=" + o.argument + "]" : "=" + o.argument);
					}
				}else{
					line += "-" + o.short;
					if (!o.flag){
						line += (o.optional ? "[" + o.argument + "]" : " " + o.argument);
					}
				}
			}else if (o.long){
				line += "    --" + (o.flag && o.negate ? "no-" + o.long : o.long);
				if (!o.flag){
					line += (o.optional ? "[=" + o.argument + "]" : "=" + o.argument);
				}
			}
		}
		
		line += "  ";
		prefix = "";
		//Fill the line with spaces
		for (var i=0; i<30; i++){
			prefix += " ";
		}
		
		var spaces = 30 - line.length;
		if (spaces < 0 && o.description){
			line += "\n" + prefix;
		}else{
			for (var i=0; i<spaces; i++){
				line += " ";
			}
		}
		
		if (o.description){
			var description = "";
			var arr = wrap (o.description, c - 30, "  ").split ("\n");
			for (var i=0, ii=arr.length; i<ii; i++){
				if (i) description += "\n" + prefix;
				description += arr[i];
			}
			line += description;
		}
		h += line;
		
		previousGroup = false;
	});
	
	if (this._footer) h += "\n\n" + wrap (this._footer, c);
	
	if (this._email) h += "\n\n" + wrap ("Report bugs to <" + this._email + ">.",
			c);
	
	console.log (h);
	process.exit (0);
};

Argp.prototype._printUsage = function (){
	var usage = "";
	var short = "";
	var shortArgs = [];
	var o;
	var c = this._configuration.columns;
		
	//Short names go first
	//-h and -v are the first options
	if (this._optionsShort.h) short += "h";
	if (this._optionsShort.v) short += "v";
	
	for (var p in this._optionsShort){
		if (p === "h" || p === "v") continue;
		
		o = this._optionsShort[p];
		if (o.hidden) continue;
		
		if (o.flag){
			short += p;
		}else{
			//Short option with value, they go after the short flags
			shortArgs.push (o);
		}
	}
	
	if (short){
		usage += " [-" + short + "]";
	}
	
	shortArgs.forEach (function (o){
		usage += " [-" + o.short +
				(o.optional ? "[" + o.argument + "]" : " " + o.argument) + "]";
	});
	
	//Long names
	this._lines.forEach (function (o){
		if (!o.long || o.hidden) return;
		
		usage += " [--" + o.long + (o.flag
				? "]"
				: (o.optional ? "[=" + o.argument + "]" : "=" + o.argument) + "]");
	});
	
	var prefix = "         ";
	
	//Arguments
	if (this._usages.length){
		var s = "";
		for (var i=0, ii=this._usages.length; i<ii; i++){
			s += (i ? "\n       " : "") + wrap ((i ? "" : "Usage: ") +
					this._script + usage + " " + this._usages[i], i ? c - 7 : c, prefix);
		}
		usage = s;
	}else{
		if (Object.keys (this._arguments).length){
			for (var p in this._arguments){
				if (this._arguments[p].hidden) continue;
				usage += " [" + p + "]";
			}
		}
		usage = wrap ("Usage: " + this._script + usage, c, prefix);
	}
	
	console.log (usage);
	process.exit (0);
};

Argp.prototype._printVersion = function (){
	console.log (wrap (this._version, this._configuration.columns));
	process.exit (0);
};

Argp.prototype._newArgument = function (str){
	if (!this._emitArguments && this._configuration.sort){
		this._argumentsArray.push (str);
		return;
	}
	
	this._ignore = false;
	this.emit ("argument", this._argv, str, this._ignoreFn);
	if (this._ignore) return;
	this._argv[str] = true;
};

Argp.prototype._convertType = function (o){
	if (o.opt.type === Number){
		var v = Number (o.value);
		if (isNaN (v)){
			this._errorConvert (o.long || o.short, "Number");
		}
		//Note: Number(null) returns 0, the default value
		o.value = v;
	}else if (o.opt.type === Boolean){
		if (o.value === "true"){
			o.value = true;
		}else if (o.value === "false"){
			o.value = false;
		}else{
			this._errorConvert (o.long || o.short, "Boolean");
		}
	}else if (o.opt.type === Array){
		o.value = o.value.split (",");
		for (var i=0, ii=o.value.length; i<ii; i++){
			//Convert the type of each element
			o.value[i] = cast (o.value[i]);
		}
	}
};

Argp.prototype._newOption = function (o){
	this._ignore = false;
	
	//Normalize the value
	if (o.flag){
		o.value = !o.negate;
	}else{
		if (o.opt){
			if (o.value === undefined){
				//Defined and no input value, set default
				o.value = o.opt.value;
			}else{
				//Convert to the configured type
				this._convertType (o);
			}
			
			//Use the reviver, if any
			if (o.opt.reviver){
				o.value = o.opt.reviver (o.value);
			}
		}else if (o.value === undefined){
			//Undefined and no input value, set null
			o.value = null;
		}else{
			//Undefined options are converted automatically to the type they represent
			o.value = cast (o.value);
		}
	}
	
	//At this point o.value contains the input value or the default whether it's
	//a flag or not
	
	this.emit ("option", this._argv, o.long || o.short, o.value, !!o.long,
			this._ignoreFn);
	
	if (this._ignore) return;
	
	if (o.opt){
		//Check for --help, --usage or --version
		if (this._configuration.showHelp && o.opt.id === "help"){
			this._printHelp ();
		}
		if (this._configuration.showUsage && o.opt.id === "usage"){
			this._printUsage ();
		}
		if (this._version && o.opt.id === "version"){
			this._printVersion ();
		}
		
		if (o.opt.type === Array){
			//The user may cache the default array, so it cannot be replaced by the
			//new one, so all the elements must be copied
			var arr = this._argv[o.opt.id];
			o.value.forEach (function (v){
				arr.push (v);
			});
		}else{
			this._argv[o.opt.id] = o.value;
		}
	}else{
		this._argv[o.long || o.short] = o.value;
	}
};

Argp.prototype._fullname = function (name, negate){
	var o = this._optionsLong[name];
	
	//Don't need to check for o.negate === negate
	
	//Exact match
	if (o) return name;
		
	//Check abbreviations
	var matches = 0;
	var re = new RegExp ("^" + name);
	var lastMatch = null;
	
	for (var p in this._optionsLong){
		if (re.test (p)){
			matches++;
			if (matches === 2){
				this._errorAbbreviation ("--" + (negate ? "no-" : "") + name);
			}
			lastMatch = p;
		}
	}
	
	//If null, the option is not defined
	return lastMatch;
};

Argp.prototype._read = function (){
	var me = this;
	var onlyArguments = false;
	//Properties: short/long, flag, negate, value, opt
	var option;
	var undefinedArguments = this._configuration.allowUndefinedArguments;
	var undefinedOptions = this._configuration.allowUndefinedOptions;
	
	var find = function (o){
		return o.long ? me._optionsLong[o.long] : me._optionsShort[o.short];
	};
	
	var free = function (){
		//This function must be called on finish, when found "--" option and when
		//found any short and long options
		if (!option) return;
		
		//Check any previous option waiting for a value and, if any, free it; the
		//previous option doesn't have a value and therefore:
		//- it's a flag (if undefined)
		//- doesn't have a value (no error if optional, error if mandatory)
		//At this point the option has been validated
		
		if (option.opt){
			//Defined option
			if (option.opt.optional){
				//No value
				me._newOption (option);
			}else{
				//If requires a value
				me._errorExpectedValue (option.long
						? "--" + option.long
						: "-" + option.short);
			}
		}else{
			//Undefined options with no value are always a flag
			option.flag = true;
			me._newOption (option);
		}
		
		option = null;
	};
	
	var value = function (str){
		if (me._arguments[str]){
			//Defined argument between an option and a possible value, eg: --a arg 1,
			//where "arg" is an argument and "a" has "1" as a value
			//Simply save the argument and proceed
			me._newArgument (str);
			return;
		}
		
		//At this point the string contains the value of the previous option
		option.value = str;
		me._newOption (option);
		option = null;
	};
	
	var long = function (str){
		//Free the previous option
		free ();
		
		var o;
		var name;
	
		if (str[2] === "n" && str[3] === "o" && str[4] === "-"){
			//Negated flag
			//Get the full name
			str = str.substring (5);
			name = str;
			str = me._fullname (name, true);
			o = str ? me._optionsLong[str] : null;
			
			if ((o && !o.flag) || (!undefinedOptions && !o)){
				//Defined no-flag option or undefined option and no undefined allowed
				me._errorUnrecognizedOption ("--no-" + str);
			}
			
			//If --a is defined and --no-a is read, we must omit the option because
			//the value of --no-a, false, it's the same as the default value of --a,
			//false
			if (o && !o.negate) return;
			
			//The option doesn't require a value
			me._newOption ({
				opt: o,
				flag: true,
				negate: true,
				long: str || name
			});
			
			return;
		}
		
		str = str.substring (2);
		
		//Check for the value in the same token
		var emptyStringValue = false;
		var value;
		var i = str.indexOf ("=");
		if (i !== -1){
			value = str.substring (i + 1);
			if (!value){
				//Empty string value
				emptyStringValue = true;
				value = undefined;
			}
			str = str.substring (0, i);
		}
		
		//Get the full name
		name = str;
		str = me._fullname (str);
		o = str ? me._optionsLong[str] : null;
		
		if (o && o.flag){
			if (value){
				//A flag with a value
				me._errorNotExpectedValue (str);
			}
			
			//If o.negate, this is the default value of the flag, eg: --no-a is
			//defined and we read --a. The default value of --no-a is true, the same
			//as --a, so we can omit it
			if (!o.negate){
				me._newOption ({
					opt: o,
					flag: true,
					long: str
				});
			}
			
			return;
		}else if (!undefinedOptions){
			//Undefined option and no undefined allowed
			me._errorUnrecognizedOption ("--" + str);
		}
		
		if (value || emptyStringValue){
			me._newOption ({
				opt: o,
				long: str || name,
				value: value
			});
		}else{
			//Wait for the value
			option = {
				opt: o,
				long: str || name
			};
		}
	};
	
	var short = function (str){
		//Note: Cannot configure a negated short option
		
		//Free the previous option
		free ();
		
		str = str.substring (1);
		var name;
		var o;
		
		//Grouped options
		for (var i=0, ii=str.length; i<ii; i++){
			//Free the previous option
			free ();
			
			name = str[i];
			o = me._optionsShort[name];
			
			if (o){
				if (o.flag){
					me._newOption ({
						opt: o,
						flag: true,
						short: name
					});
				}else{
					if (!i){
						//First option
						//Check whether the value is in the same token
						if (ii > 1){
							//Assumption: if an undefined option follows the first defined
							//no-flag option, the next undefined characters to the first
							//defined option are the value of this option
							if (!me._optionsShort[str[i + 1]]){
								me._newOption ({
									opt: o,
									short: name,
									value: str.substring (1)
								});
								break;
							}else if (o.optional){
								me._newOption ({
									opt: o,
									short: name,
									value: null
								});
							}else{
								//The option requires a value
								me._errorExpectedValue ("-" + name);
							}
						}else{
							//Wait for the value
							option = {
								opt: o,
								short: name
							};
						}
					}else if (i < ii - 1){
						//Options between the first and the last
						if (o.optional){
							//No value
							me._newOption ({
								opt: o,
								short: name
							});
						}else{
							//The option requires a value
							me._errorExpectedValue ("-" + name);
						}
					}else{
						//Last option
						//Wait for the value
						option = {
							opt: o,
							short: name
						};
					}
				}
			}else{
				if (!undefinedOptions){
					//Undefined option and no undefined allowed
					me._errorUnrecognizedOption ("-" + name);
				}
				
				//Wait for the value
				option = {
					opt: null,
					short: name
				};
			}
		}
	};
	
	var argument = function (str){
		if (!undefinedArguments && !me._arguments[str]){
			//Undefined argument and no undefined allowed
			me._errorUnrecognizedArgument (str);
		}
		
		me._newArgument (str);
	};
	
	process.argv.slice (this._debug ? 3 : 2).forEach (function (str){
		if (onlyArguments){
			me._newArgument (str);
			return;
		}
		
		if (str === "--"){
			free ();
			onlyArguments = true;
			return;
		}
		
		if (str === "-"){
			//Special case
			if (option){
				//Allow the option value "-"
				option.value = str;
				me._newOption (option);
				option = null;
			}else{
				//Assumption: an option with name "-" is an argument
				argument (str);
			}
			return;
		}
		
		if (str[0] === "-"){
			if (option && option.opt && option.opt.type === Number){
				//Special case
				//Option with a negative Number value, eg: --a -12.34
				option.value = str;
				me._newOption (option);
				option = null;
				return;
			}
			
			if (str[1] === "-"){
				//Long option
				long (str);
			}else{
				//Short option
				short (str);
			}
		}else if (option){
			//Option waiting for a value
			value (str);
		}else{
			argument (str);
		}
	});
	
	free ();
};

Argp.prototype.arguments = function (){
	return this._arguments;
};

Argp.prototype._default = function (){
	var me = this;
	this._lines.forEach (function (o){
		if (o.text || o.group || o.arg) return;
		me._argv[o.id] = o.value;
	});
	for (var p in this._arguments){
		this._argv[p] = false;
	}
};

Argp.prototype.argv = function (){
	if (this._argv) return this._argv;
	
	this._argv = {
		_debug: this._debug,
		_filename: this._filename
	};
	
	//Set default values
	this._default ();
	
	this.emit ("start", this._argv);
	
	//Read options
	this._read ();
	
	//Emit arguments if sort is enabled
	if (this._configuration.sort){
		var me = this;
		this._emitArguments = true;
		this._argumentsArray.forEach (function (str){
			me._newArgument (str);
		});
	}
	
	//Clean up resources
	this._free ();
	
	this.emit ("end", this._argv);
	
	return this._argv;
};

Argp.prototype.body = function (fn){
	fn (new Body (this));
	
	return this;
};

Argp.prototype.configuration = function (o){
	if (o.showHelp){
		this._configuration.showHelp = true;
		this._option ({
			short: "h",
			long: "help",
			description: "Display this help message and exit"
		}, true);
	}
	
	if (o.showUsage){
		this._configuration.showUsage = true;
		this._option ({
			long: "usage",
			description: "Display a short usage message and exit"
		}, true);
	}
	
	if (o.allowUndefinedOptions === false){
		this._configuration.allowUndefinedOptions = false;
	}
	
	if (o.allowUndefinedArguments === false){
		this._configuration.allowUndefinedArguments = false;
	}
	
	if (o.columns !== undefined){
		this._configuration.columns = o.columns < 32 ? 80 : o.columns;
	}
	
	if (o.sort) this._configuration.sort = true;
	
	return this;
};

Argp.prototype.description = function (str){
	this._description = str;
	return this;
};

Argp.prototype.email = function (str){
	this._email = str;
	return this;
};

Argp.prototype.fail = function (str, code){
	console.error (this._script + ": " + str);
	this._errorTry ();
	process.exit (code || 1);
};

Argp.prototype.footer = function (str){
	this._footer = str;
	return this;
};

Argp.prototype._option = function (o, push){
	o.flag = !o.argument;
	o.id = o.long || o.short;
	o.description = o.description || null;
	o.hidden = !!o.hidden;
	
	//Clean up
	if (o.flag){
		delete o.reviver;
		delete o.value;
		delete o.optional;
		delete o.type;
		o.negate = !!o.negate;
		o.value = o.negate;
	}else{
		o.type = o.type || String;
		o.optional = !!o.optional;
		o.reviver = o.reviver || null;
		delete o.negate;
		if (o.value === undefined){
			if (o.type === Number){
				o.value = 0;
			}else if (o.type === Boolean){
				o.value = false;
			}else if (o.type === Array){
				o.value = [];
			}else{
				o.value = null;
			}
		}
	}
	
	//Save the option
	if (push){
		this._lines.push (o);
	}else{
		this._lines.splice (this._next++, 0, o);
	}
	
	this._options[o.id] = o;
	
	//Shortcuts
	if (o.short) this._optionsShort[o.short] = o;
	if (o.long) this._optionsLong[o.long] = o;
};

Argp.prototype.options = function (){
	return this._options;
};

Argp.prototype.usage = function (str){
	this._usages.push (str);
	return this;
};

Argp.prototype.version = function (str){
	this._version = str;
	this._option ({
		short: "v",
		long: "version",
		description: "Output version information and exit"
	}, true);
	return this;
};

var Body = function (argp){
	this._argp = argp;
	this._reWhitespace = /\s/;
};

Body.prototype.argument = function (name, o){
	if (this._reWhitespace.test (name)){
		throw new ArgpError ("The argument canot contain whitespace characters");
	}
	if (this._argp._arguments[name]){
		throw new ArgpError ("The argument \"" + name + "\" is already defined");
	}
	this._argp._lines.splice (this._argp._next++, 0, {
		arg: name
	});
	o = o || {};
	o.hidden = !!o.hidden;
	o.description = o.description || null;
	this._argp._arguments[name] = o;
	return this;
};

Body.prototype.group = function (str){
	//Group lines are pushed to the options array to maintain the insertion order
	this._argp._lines.splice (this._argp._next++, 0, {
		group: str
	});
	return this;
};

Body.prototype.option = function (o){
	if (!o.long && !o.short) throw new ArgpError ("At least a long name " +
			"must be configured");
	
	if (o.negate && o.short) throw new ArgpError ("Cannot configure a short " +
			"name if the option is a negative flag");
			
	if (o.long){
		//Long names cannot contain whitespaces
		if (this._reWhitespace.test (o.long)){
			throw new ArgpError ("The long name canot contain whitespace characters");
		}
		//Cannot be already defined
		for (var p in this._argp._optionsLong){
			if (p === o.long){
				throw new ArgpError ("The long name \"" + o.long +
						"\" is already defined");
			}
		}
	}
	
	if (o.short){
		if (o.short.length > 1){
			throw new ArgpError ("The short name must be a single character");
		}
		//Short names must be alphanumeric characters
		var code = o.short.charCodeAt (0);
		if (!((code >= 48 && code <= 57) || (code >= 65 && code <= 90) ||
				(code >= 97 && code <= 122))){
			throw new ArgpError ("The short name must be an alphanumeric character");
		}
		//Cannot be already defined
		for (var p in this._argp._optionsShort){
			if (p === o.short){
				throw new ArgpError ("The short name \"" + o.short +
						"\" is already defined");
			}
		}
	}
	
	this._argp._option (o);
	
	return this;
};

Body.prototype.text = function (str){
	//Text lines are pushed to the options array to maintain the insertion order
	this._argp._lines.splice (this._argp._next++, 0, {
		text: str
	});
	return this;
};

module.exports = new Argp ();