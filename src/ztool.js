var fs = require('fs'),
    path = require('path');

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

