var fs = require('fs'),
    path = require('path'),

    us = require('underscore'),
    CSSOM = require('cssom');

/**
 * CSS Style Declaration 的通用方法定义
 * @type {Object}
 * @example
 * CSSStyleDeclaration: {
 *     0: "border",
 *     1: "color",
 *     length: 2,
 *     border: "none",
 *     color: "#333"
 * }
 */
var BaseCSSStyleDeclaration = {
    
    /**
     * 从 BaseCSSStyleDeclaration 继承通用方法     
     * @param  {CSSStyleDeclaration} style 
     */
    inherits: function(style){

        return us.extend(style, this);
    },

    /**
     * 把background 属性拆分
     * e.g. background: #fff url('...') repeat-x 0px top;
     */
    splitBackground: function(){

        var background, 
            value;

        if(!this['background']){

            // 有 background 属性的 style 才能拆分 background 
            return;
        }

        // 撕裂 background-position
        if(value = this['background-position']){

            value = value.trim().replace(/\s{2}/g,'').split(' ');
            if(!value[1]){
                value[1] = value[0];
            }
            this['background-position-x'] = value[0];
            this['background-position-y'] = value[1];
        }
        background = BI.analyse(this['background']);
        if(background.length != 1){

            // FIXME 暂时跳过多背景的属性
            return;
        }
        background = background[0];
        if(background['background-image']){

            // 把原来缩写的 background 属性删掉
            this.removeProperty('background');

            this.extend(background);
        }
    },

    /**
     * 把 style 里面的 background 属性转换成简写形式, 用于减少代码
     */
    mergeBackgound: function(){

        var background = '', style = this;

        var positionText = this.removeProperty('background-position-x') + ' ' +
                           this.removeProperty('background-position-y');

        style.setProperty('background-position', positionText.trim(), null);

        var toMergeAttrs = [
               'background-color', 'background-image', 'background-position', 
               'background-repeat','background-attachment', 
               'background-origin', 'background-clip'
        ];
        for(var i = 0, item; item = toMergeAttrs[i]; i++) {

            if(style.hasOwnProperty(item)){

                background += this.removeProperty(item) + ' ';
            }
        }
        style.setProperty('background', background.trim(), null);
    },

    /**
     * 把 obj 的属性和属性值扩展合并过来, 并调整下标, 方法将被忽略
     * @param  {Object} obj 
     * @param  {Boolean} override 是否覆盖已有属性
     */
    extend: function(obj, override){

        for(var i in obj){

            if(us.isFunction(obj[i])){

                continue;
            }else if(this[i] && !override){

                continue;
            }
            this.setProperty(i, obj[i], null);
        }

    },

    /**
     * 调整 样式规则的像素值, 如果原来就有值, 则在原来的基础上变更
     */
    setValueWithPx: function(attr, newValue){

        var value;
        if(this[attr]){

            value = parseInt(this[attr]);
        }else{

            value = 0;
            this[this.length++] = attr;
        }
        value = value - newValue;
        value = value ? value + 'px' : '0';
        this[attr] = value;
    },

    /**
     * 从background-image 的值中提取图片的路径
     * @return {String}       url
     */
    getImageUrl: function(style, dir){
        var format = spriteConfig.input.format,
            ignoreImages = spriteConfig.input.ignoreImages,
            backgroundImage = style['background-image'],
            url = null,
            ext,
            match;

        if(!backgroundImage){
            return null;
        }

        if(backgroundImage.indexOf(',') > -1){

            // FIXME 暂时忽略掉多背景的属性
            // FIXME 提取 url 进行拷贝
            return null;
        }

        match = backgroundImage.match(regexp.image);

        if(match){
            url = match[1];
            ext = match[2];
            
            if(format.indexOf(ext) == -1){ // 去掉非指定后缀的图片

                unspriteImageArray.push(path.join(dir, url));
                return null;
            }
            if(regexp.ignoreImage.test(backgroundImage)){ // 去掉不需要合并图片

                unspriteImageArray.push(path.join(dir, url));
                info('>>Skip: Unsprite image "' + url + '"');
                url = backgroundImage.replace(regexp.ignoreImage, '');
                style.setProperty('background-image', url, null);
                return null;
            }

        }else{
            debug('not match image bg: '+ backgroundImage);
            return null;
        }
        
        // 遇到网络图片就跳过
        if(regexp.ignoreNetwork.test(url)){

            // 这里直接返回了, 因为一个style里面是不会同时存在两个 background-image 的
            info('>>Skip: Network image "' + url + '"');
            return null;
        }

        if(ignoreImages){
            for(var i = 0; i < ignoreImages.length; i++){
                
                if(ignoreImages[i].test(url)){
                    info('>>Skip: Unsprite image "' + url + '"');
                    return null;
                }
            }
        }
        
        return url;
    }
}

module.exports = BaseCSSStyleDeclaration;