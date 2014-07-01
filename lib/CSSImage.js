
// - CSSImage {} css 图片信息汇总
//         - url css 文件中 url() 中的原始值
//         - filename 图片的文件名
//         - filepath 图片的绝对路径
//         - ext 图片的后缀
//         - width 图片宽度
//         - height 图片高度
//         - size 图片大小

function CSSImage (env, url) {
    
    this.url = url;

    
}

module.exports = CSSImage;