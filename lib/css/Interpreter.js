/**
 * from: https://github.com/iazrael/xmlparser
 */

(function(name, definition){
    if(typeof define === 'function'){
        define(definition);
    }else if(typeof module !== 'undefined'){
        module.exports = definition();
    }else{
        this[name] = definition();
    }
})('Interpreter', function(undefined){

    var MATCH_NONE = 0;//没有匹配
    var MATCH_EXACTLY = 1;//完全匹配了一个
    var MATCH_POLYSEMY = 2;//存在多个可能的匹配项

    var CYCLE_BOUNDARY = 10;//pos 没有变化超过 10次, 就认为是陷入死循环了

    var toString = Object.prototype.toString;

    function isArray (obj){
        return toString.call(obj) === '[object Array]';
    }

    /**
     * 通用文本解析引擎，可以用来解析xml, JSON等
     */
    function Interpreter(tokenArray){
        this.tokenArray = tokenArray;
    }

    Interpreter.prototype = {
        /**
         * 判读一个字符或字符串是否是token, 严格匹配
         * @param  {String}  text 
         * @param {Array} extra 限定 text是token的同时, 也属于该指定数组
         * 
         * @return {Boolean}
         */
        isToken: function(text, extra){
            var match = this.tokenArray.indexOf(text) > -1;
            if(match && extra){
                return extra.indexOf(text) > -1;
            }
            return match;
        },
        /**
         * 判断一个字符或字符串是否匹配到了一个 token
         * 匹配情况分三种
         * 1: 唯一完全匹配, 返回会 MATCH_ONE
         * 2: 匹配了多个开头, 返回 MATCH_POLYSEMY
         * 3: 未有匹配, 返回 MATCH_NONE
         * @param  {String}  text 
         * 
         * @return {Number}
         */
        checkToken: function(text){
            var count = 0;
            for(var i = 0, t; t = this.tokenArray[i]; i++){
                if(t.indexOf(text) === 0){
                    count++;
                }
                if (count >= 2) {//已经有两个匹配了, 可以退出循环了
                    break;
                }
            }
            if(count > 1){
                return MATCH_POLYSEMY;
            }
            if(!count){//0
                return MATCH_NONE;
            }
            //=1
            if(this.isToken(text)){
                return MATCH_EXACTLY;
            }
            //例如 text='<!', 但token 中有 <!, <!-- 等
            return MATCH_POLYSEMY;
        },
        /**
         * 设置将要解析的文本，准备解析
         * @param  {String} text 
         */
        prepare: function(text){
            this.text = text;
            this.length = text.length;
            this.pos = 0;
            this.cycling = 0;
        },
        /**
         * 把文本按照tokenArray进行切割，按顺序返回一个字符或字串
         * 
         * @return {{String}|null} 返回字符或字串，如果已经到结尾，则返回null
         */
        eat: function(){
            var ch, m, 
                text, 
                buffer = '',
                polysemy = false
                ;
            while(this.pos < this.length){
                ch = this.text.charAt(this.pos);
                if(polysemy){
                    text = buffer + ch;
                }else{
                    text = ch;
                }
                m = this.checkToken(text);
                if(m === MATCH_POLYSEMY){
                    if(!polysemy && buffer.length){
                        return buffer;
                    }
                    buffer += ch;
                    this.pos ++;
                    polysemy = true;
                }else if(m === MATCH_EXACTLY){
                    if(polysemy){
                        this.pos ++;
                        return text;
                    }
                    if(buffer.length){
                        return buffer;
                    }
                    this.pos ++;
                    return ch;
                }else{
                    if(polysemy){
                        return buffer;
                    }
                    buffer += ch;
                    this.pos ++;
                }
            }
            return null;
        },
        /**
         * 把指定until之前的字符都返回，until可以是字符串或者字符串数组，
         * 但都必须是tokenArray的子集，否则忽略掉
         * @param  {{String}|{Array}} until 限定用的token
         * 
         * @return {String} 返回指定字符串，当在until之前都没有字符时，返回空串''
         *
         * @exception CyclingError 当监测到连续多次, 字符的处理进度都没变化时, 抛出该异常
         */
        eatUntil: function(until){
            if(this.cycling >= CYCLE_BOUNDARY){
                throw new Error('CyclingError: do you run eatUntil in a empty loop?');
            }
            if(until && !isArray(until)){
                until = [until];
            }
            var pos = this.pos,
                result = '',
                food;
            while((food = this.eat()) !== null && !this.isToken(food, until)){
                result += food;
                pos = this.pos;
            }
            if(this.pos === pos){
                this.cycling++;
            }
            this.pos = pos;
            return result;
        }
    };

    return Interpreter;

});