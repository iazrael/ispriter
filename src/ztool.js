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

exports.friendlyJsonParse = function(jsonStr){
    return Function('return ' + jsonStr)();
}