var fs = require('fs'),
    path = require('path'),
    util = require('util'),
    _ = require('underscore'),
    iCanvas = require('./canvas').Canvas,
    GrowingPacker = require('./algorithm/GrowingPacker'),


    EventEmitter = require('events').EventEmitter,
    EventProxy = require('eventproxy'),
    Logger = require('./Logger'),

    info = Logger.info,
    debugInfo = Logger.debug;

var spriteConfig ;

/**
 * [比起SpriteImage对象，更加重要的是sprite对象，是个装载ImageInfo的Obj]
 * TODO 这里的变量丑死了
 * @param {[type]} config     [description]
 * @param {[type]} imageInfos [description]
 */
function SpriteImage(spritetask){
	this.imageInfos = spritetask.imageInfos;
	this.config = spritetask.env.config;
    this.cssFileName = spritetask.cssSheet.filename;

    //尴尬死了，先完成功能先
    this.task = spritetask;

    //TODO spirteConfig把它设为一个模块，全局引用，不用传来传去的
    spriteConfig = this.config;
    this.cssNames = _getClassNamesByCssRules(spritetask ); //收集这个css文件的所有className
    this.spriteArray = this.positionImages();
}
//辅助函数，获取这个css文件的所有className
function _getClassNamesByCssRules(spritetask){
    var result = [],
        cssRules = [];

    if(spritetask.cssSheetArray){ //证明是合并的task
        spritetask.cssSheetArray.forEach(function(sheet){
            cssRules = _.union(cssRules, sheet.cssRules);
        })
    }else{
        cssRules = spritetask.cssSheet.cssRules;
        
    }
    cssRules.forEach(function(cssRule){
        result.push(cssRule.cssName);
    })


    return result;
}


/**
 * 对需要合并的图片进行布局定位
 * sprite 是个特殊数组，装载packer过的imageInfo和有个额外的root属性
 * 
 */
SpriteImage.prototype.positionImages = function(){

    var spriteArray = [],// 注意这样应该是imageInfo二维数组
        sprite = [], 	 // 一个sprite数组装载imageInfo，就是合并一张合图
        existArr = [],	 // 保存已经合并过的图片的imageInfo
        maxSize = this.config.output.maxSingleSize,
        packer = new GrowingPacker();


    // 把已经合并了并已输出的图片先排除掉
    for(var i in this.imageInfos){
        var imageInfo = this.imageInfos[i];

        var targetArr = imageInfo.drew ? existArr : sprite;
        targetArr.push(imageInfo);

    }

    // 如果限制了输出图片的大小, 则进行分组
    if(maxSize){
        /* 
         * 限制图片大小的算法是:
         * 1. 先把图片按从大到小排序
         * 2. 顺序叠加图片 size , 超过maxSize 时, 另起一个数组
         * 3. 最终把一个数组, 拆成 N 个 总 szie 小于 maxSize 的数组
         */
        sprite.sort(function(a, b){
            return b.size - a.size;
        });
        
        var total = 0, ret = [];
        sprite.forEach(function(imageInfo){
            total += imageInfo.size;

            if(total > maxSize){
                if(ret.length){ // 避免出现空图片
                    spriteArray.push(ret);
                    ret = [];
                    total = imageInfo.size;
                }
            }
            ret.push(imageInfo);
        });

        if(ret.length){
            spriteArray.push(ret);
        }
    }else{
        spriteArray.push(sprite);
    }
    
    spriteArray.forEach(function(sprite){

        /* 
         * packer 算法需要把最大的一个放在首位...
         * 排序算法会对结果造成比较大的影响
         */
        sprite.sort(function(a, b){
            return b.w * b.h - a.w * a.h;
        });

        // 用 packer 对数组元素进行定位
        packer.fit(sprite);

        /* 
         * root 的值就是 packer 定位的结果
         * root.w / root.h 表示图片排列后的总宽高
         * 各个小图片的坐标这在 sprite 的元素中, 新增了一个 fit 属性
         * fit.x / fit.y 表示定位后元素的坐标
         */
        sprite.root = packer.root;   //直接在数组里面赋值属性，好像不按常理出牌
    });

    if(existArr.length){
        spriteArray.push(existArr);
    }
    return spriteArray;
}

//****************************************************************
// 5. 根据定位合并图片并输出, 同时修改样式表里面的background
//****************************************************************

SpriteImage.prototype.drawImageAndPositionBackground = function(){
    
    var combinedCssRules = {},
        self = this,
        spriteArray = this.spriteArray,
        config = this.config;

    // 保存用了同一张精灵图的选择器, 用于最后输出 css 文件的时候统一设置 background-image
    //combinedCssRules = { 
    //  './sprite_output/sprite_1.png': {imageName: '', selectors: []}
    //};

    this.combinedCssRules = combinedCssRules;

    /* 
     * 若最后一个元素, 没有root 属性, 说明它的样式都是复用已合并的图片的, 
     * 直接替换样式即可
     */
    if(!spriteArray[spriteArray.length - 1].root){
        
        var sprite = spriteArray.pop();

        sprite.forEach(function(imageInfo){

            var imageName = imageInfo.imageName;

            if(!combinedCssRules[imageName]){
                combinedCssRules[imageName] = [];
            }
            // 修改 background 属性
            self.replaceAndPositionBackground(imageName, imageInfo, 
                    combinedCssRules[imageName]);
        });
    }

    spriteArray.forEach(function(sprite, i){
        var icanvas = new iCanvas(sprite.root.w, sprite.root.h);
        var imageName = createSpriteImageName(self.cssFileName, i, spriteArray.length);

        sprite.forEach(function(imageInfo){

            if(!imageInfo.image) return;

            var image = imageInfo.image;

            if(!combinedCssRules[imageName]){
                combinedCssRules[imageName] = [];
            }

            // 修改 background 属性
            self.replaceAndPositionBackground(imageName, imageInfo, combinedCssRules[imageName]);
            // 在画布上对图片进行填充
            icanvas.drawImage(image, imageInfo.fit.x, imageInfo.fit.y, image.width, image.height);

            imageInfo.drew = true;
            imageInfo.imageName = imageName;
            debugInfo('-----  done one imageInfo -----')
        });

        debugInfo('--- out it--');

        //  输出定位后的图片
        if(sprite.length){ // 没必要输出一张空白图片
            var imageName2 = path.join(config.output.cssDist, imageName);
            imageName2 = path.normalize(imageName2);

            var imageAbsName = path.join(config.workspace, imageName2);
            imageAbsName = path.resolve(imageAbsName);

            icanvas.toFile(imageAbsName,function(){
                info('>>Output image:', imageName2);
            });

        }
    });
    
}


/**
 * 创建精灵图的文件名, 前缀 + css 文件名 + 文件后缀, 如果设置了 maxSingleSize, 
 * 则会在文件名后面加上下标
 * @param  {String} cssFileName 
 * @param  {Number} index       
 * @param  {Number} total       
 */
function createSpriteImageName(cssFileName, index, total){

    var name = '';
    if(cssFileName){ // 去掉文件后缀, 提取出文件名字
        var basename = path.basename(cssFileName);
        var extname = path.extname(basename);
        name = basename.replace(extname, '');
    }

    // 设置了 maxSingleSize, 文件名会是类似 _1, _2 这种
    if(spriteConfig.output.maxSingleSize && total > 1){
        name += '_' + index;
    }
    name = spriteConfig.output.prefix + name + '.' + spriteConfig.output.format;
    return spriteConfig.output.imageDist + name;
}

/**
 * 把合并的结果写到样式中, 修改 background-image 和 background-position 属性,并且把 background 的字属性都合并掉
 * 经过考虑，不是用修改属性的方式采用，删除原始的和合图属性，然后增加合图之后的属性方法。
 * @param  {String} imageName   
 * @param  {StyleObj} imageInfo    
 * @param  {Array} combinedSelectors 被合并了图片的选择器
 */
SpriteImage.prototype.replaceAndPositionBackground = function(imageName, imageInfo, combinedSelectors){
    var self = this;
    imageInfo.cssRules.forEach(function(cssRule){

        var cssRuleSpriteAttr = cssRule['__outSpriteAttr'] = {};

        if(spriteConfig.output.combineCSSRule){
            // 不分别设置 background-image, 改为统一设置, 减少 css 文件大小

            if(cssRule.cssName && (_.contains(self.cssNames, cssRule.cssName) || spriteConfig.output.combine) ){
                combinedSelectors.push(cssRule.cssName);
            }
        }else{
            cssRuleSpriteAttr['background-image'] = 'url(' + imageName + ')';
        }

        // set background-position-x
        //setPositionValue(cssRule, 'background-position-x', imageInfo.fit.x);
        // set background-position-y
        //setPositionValue(cssRule, 'background-position-y', imageInfo.fit.y);

        // mergeBackgound, 合并 background 属性, 减少代码量 
        // TODO 考虑这个方法还有没有用了
        //cssRule.mergeBackgound();

        // 现在同一不支持带有repeat的背景合图
        cssRuleSpriteAttr['background-repeat'] = 'no-repeat';

        cssRuleSpriteAttr['background-position'] = getNewPosition(cssRule,'background-position-x',imageInfo.fit.x) + ' ' + 
                                                   getNewPosition(cssRule,'background-position-y',imageInfo.fit.y);

    });
}

/**
 * 调整 样式规则的像素值, 如果原来就有值, 则在原来的基础上变更
 */
function setPositionValue(cssRule, attr, newValue){
    var value;
    if(cssRule['__normalizer'][attr]){
        value = parseInt(cssRule['__normalizer'][attr]);
    }else{
        value = 0;
    }
    value = value - newValue;     //如果原来的就有background-position，就在此基础上相减
    value = value ? value + 'px' : '0';
    
    cssRule['__spriteAttr'][attr] = value;

    //update in here
    cssRule[attr].value = newValue;
}

//TODO 下面这个方法更加简洁和情绪，请替换上面的旧方法
function getNewPosition(cssRule, attr, newValue){
    var oldvalue = cssRule['__normalizer'][attr] || 0 ;
    var result = oldvalue - newValue;     //如果原来的就有background-position，就在此基础上相减
    return result ? result + 'px' : '0';
}



module.exports = SpriteImage;







