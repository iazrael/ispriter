
/**
 * 从 zTool 中扣出来的方法们
 */

var us = require('underscore');


exports.startsWith = function(str, start){
    var index = str.indexOf(start);
    return index === 0;
}

exports.endsWith = function(str, end){
    var index = str.lastIndexOf(end);
    return index !== -1 && index + end.length === str.length;
}

exports.jsonParse = function(jsonStr){
    return Function('return ' + jsonStr)();
}

exports.forEach = function(array, onEach, onDone){
    var keys = null;
    if(!us.isArray(array)){
        if(us.isObject(array)){
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
            onDone && onDone(count);
            return;
        }
        var key = keys ? keys[index] : index;
        onEach && onEach(array[key], key, next);
    };
    next();
}

/**
 * 合并几个对象并返回 baseObj,
 * 如果 extendObj 有数组属性, 则直接拷贝引用
 * @param {Object} baseObj 基础对象
 * @param {Object} extendObj ... 
 * 
 * @return {Object} baseObj
 * 
 **/
var merge = exports.merge = function(baseObj, extendObj1, extendObj2/*, extnedObj3...*/){
    var argu = arguments;
    var extendObj;
    for(var i = 1; i < argu.length; i++){
        extendObj = argu[i];
        for(var j in extendObj){
            if(us.isArray(extendObj[j])){
                baseObj[j] = extendObj[j].concat();
            }else if(us.isObject(extendObj[j])){
                if(baseObj[j] && us.isArray(baseObj[j])){
                //避免给数组做 merge
                    baseObj[j] = merge({}, extendObj[j]);
                }else{
                    baseObj[j] = merge({}, baseObj[j], extendObj[j]);
                }
            }else{
                baseObj[j] = extendObj[j];
            }
        }
    }
    return baseObj;
}

exports.wildcardToPattern = function(wildcard){
    var map = {
        '*': '.*?',
        '?': '.{1}',
        '.': '\\.'
    };

    var reg = wildcard.replace(/\*|\?|\./g, function(m, i, str){
        return map[m] || m;
    });

    return new RegExp(reg);
}