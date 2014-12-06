##了解最新ispriter结构，请查看脑图：
[http://naotu.baidu.com/viewshare.html?shareId=art0stlhnwck](http://naotu.baidu.com/viewshare.html?shareId=art0stlhnwck)

iSpriter {Main}
    - SpriteTask {} 一个合并任务

    - CSSSheet {} css 文件信息汇总
        - filename css 文件名
        - filepath css 文件的绝对路径
        - cssRules [CSSRule] 该 css 文件的所有样式规则
        - imports [CSSSheet] @import 引入的所有样式文件
        - url css 文件中 @import 的原始值

    - CSSRule {} css 规则信息汇总, 数据结构与具体的 CSS 解析器有关

    - CSSImage {} css 图片信息汇总
        - url css 文件中 url() 中的原始值
        - filename 图片的文件名
        - filepath 图片的绝对路径
        - ext 图片的后缀
        - width 图片宽度
        - height 图片高度
        - size 图片大小

    - SpriteUtils 辅助工具类，task流程的非核心函数

    - Logger 日志方法

    - Config 配置相关方法

    - FileTool 文件处理相关工具方法

    - zTool 其他工具方法

    - constant 常量
