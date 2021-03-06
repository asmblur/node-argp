"use strict";

var util = require ("util");
var Argp = require ("./argp");

var Command = module.exports = function (argp, name, o){
  Argp.call (this);
  
  o = o || {};
  Command._validateTrailing (o.trailing);
  
  this._command = true;
  this._argp = argp;
  this._name = name;
  this._trailing = o.trailing;
};

util.inherits (Command, Argp);

Command._validateTrailing = function (trailing){
  if (!trailing) return;
  
  var eq = trailing.eq !== undefined;
  var min = trailing.min !== undefined;
  var max = trailing.max !== undefined;
  
  if (eq && (min || max)){
    throw new Error ("Cannot configure \"trailing.eq\" along with " +
        "\"trailing.min\" or \"trailing.max\"");
  }
  
  if (eq && trailing.eq < 1){
    throw new Error ("\"trailing.eq\" must be greater than 1");
  }
  if (min && trailing.min < 0){
    throw new Error ("\"trailing.min\" must be greater than 1");
  }
  if (max && trailing.max < 1){
    throw new Error ("\"trailing.max\" must be greater than 1", 2);
  }
  
  if (min && max){
    if (trailing.min === trailing.max){
      trailing.eq = min;
      delete trailing.min;
      delete trailing.max;
    }else if (trailing.min > trailing.max){
      throw new Error ("\"trailing.max\" must be greater or equal than " +
          "\"trailing.min\"");
    }
  }
  if (!min){
    trailing.min = 0;
  }
  if (!max){
    trailing.max = Infinity;
  }
};

//Forward to the main Argp instance
Command.prototype.argv = function (input){
  return this._argp.argv.call (this._argp, input);
};

//Forward to the main Argp instance
Command.prototype.command = function (){
  return this._argp.command.apply (this._argp, arguments);
};

//Forward to the main Argp instance
Command.prototype.commands = function (){
  return this._argp.commands.apply (this._argp, arguments);
};

Command.prototype.main = function (){
  return this._argp;
};