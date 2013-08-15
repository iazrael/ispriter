var fs = require('fs'),
    path = require('path');

var toString = Object.prototype.toString;

exports.is = function(type, obj) {
    var clas = toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}

exports.isString = function(obj){
    return toString.call(obj) === '[object String]';
}

exports.isArray = Array.isArray || function(obj){
    return toString.call(obj) === '[object Array]';
}

exports.isArguments = function(obj){
    return toString.call(obj) === '[object Arguments]';
}

exports.isObject = function(obj){
    return toString.call(obj) === '[object Object]';
}

exports.isFunction = function(obj){
    return toString.call(obj) === '[object Function]';
}

exports.isUndefined = function(obj){
    return toString.call(obj) === '[object Undefined]';
}

exports.endsWith = function(str, end){
    var index = str.lastIndexOf(end);
    return index + end.length == str.length;
}

exports.jsonParse = function(jsonStr){
    return Function('return ' + jsonStr)();
}

exports.forEach = function(array, onEach, onEnd){
    var keys = null;
    if(!this.isArray(array)){
        if(this.isObject(array)){
            keys = [];
            for(var i in array){
                if(array.hasOwnProperty(i)){
                    keys.push(i);
                }
            }
        }else{
            throw new Error('not an array or a object');
        }
    }
    var index = -1, count = (keys || array).length;
    var next = function() {
        if(++index >= count){
            onEnd && onEnd(count);
            return;
        }
        var key = keys ? keys[index] : index;
        onEach && onEach(key, array[key], next);
    };
    next();
}

