var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    GrowingPacker = require('./algorithm/GrowingPacker'),


    EventEmitter = require('events').EventEmitter,
    EventProxy = require('eventproxy'),
    Logger = require('./Logger'),

    info = Logger.info,
    debugInfo = Logger.debug;


function SpriteImage(config, cssSheet){

	this.cssSheet = cssSheet;
	this.config = config;

}


/**
 * 对需要合并的图片进行布局定位
 * @return {Array} 返回 spriteArrayay 的数组, 
 * SpriteImageArray 的每个元素都是 cssRule 数组, 
 * 一个 cssRule 数组包含了一张精灵图的所有小图片
 */
SpriteImage.prototype.positionImages = function(){
	var cssRules = this.cssSheet.cssRules;

    //arr数组装载cssrule，代表合一张图。而spriteArray是个二维数组，装载的为arr数组
    var spriteArray = [],
        arr = [], 		// 需要去合并的图片样式
        existArr = [],	// 保存已经合并过的图片的样式
        maxSize = this.config.output.maxSingleSize,
        packer = new GrowingPacker();


    // 把已经合并了并已输出的图片先排除掉
    for(var i in cssRules){
        if(i === 'length') continue;
        var cssRule = cssRules[i];
        if(!cssRule.imageInfo) continue;  //TODO 一些有background但是没有引用图片的，是没有imageInfo的。

        var targetArr = cssRule.imageInfo.drew ? existArr : arr;
        targetArr.push(cssRule);

        //TODO START 这里使用合图后，格式不正确，导致输出不对
        //info(cssRule.__narmalizer);
        //info(cssRule.imageInfo)
    }

    // 如果限制了输出图片的大小, 则进行分组
    if(maxSize){
        /* 
         * 限制图片大小的算法是:
         * 1. 先把图片按从大到小排序
         * 2. 顺序叠加图片 size , 超过maxSize 时, 另起一个数组
         * 3. 最终把一个数组, 拆成 N 个 总 szie 小于 maxSize 的数组
         */
        arr.sort(function(a, b){
            return b.imageInfo.size - a.imageInfo.size;
        });
        
        var total = 0, ret = [];
        arr.forEach(function(cssRule){
            total += cssRule.imageInfo.size;

            if(total > maxSize){
                if(ret.length){ // 避免出现空图片
                    spriteArray.push(ret);
                    ret = [];
                    total = cssRule.imageInfo.size;
                }
            }
            ret.push(cssRule);
        });

        if(ret.length){
            spriteArray.push(ret);
        }
    }else{
        spriteArray.push(arr);
    }
    
    spriteArray.forEach(function(arr){

        /* 
         * packer 算法需要把最大的一个放在首位...
         * 排序算法会对结果造成比较大的影响
         */
        arr.sort(function(a, b){
            return b.w * b.h - a.w * a.h;
        });

        // 用 packer 对数组元素进行定位
        packer.fit(arr);

        /* 
         * root 的值就是 packer 定位的结果
         * root.w / root.h 表示图片排列后的总宽高
         * 各个小图片的坐标这在 arr 的元素中, 新增了一个 fit 属性
         * fit.x / fit.y 表示定位后元素的坐标
         */
        arr.root = packer.root;   //TODO 直接在数组里面赋值属性，好像不按常理出牌
    });

    if(existArr.length){
        spriteArray.push(existArr);
    }
    return spriteArray;
}

module.exports = SpriteImage;
