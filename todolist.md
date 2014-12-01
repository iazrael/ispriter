#TODO List

1. unspiter参数去掉，改成matchsprite，支持正则，数组。
2. env 对象被传来传去，需要把他全局化（代码优化）
3. 有些地方叫spriteTask，有些地方叫task，underscore 叫 us 或 _ ，cssName 和 className，filepath (统一变量名字吧)

4. background 现在是数组，但是进过过滤后，background和background-image都知会有一个。后继去除掉关于background是数组的逻辑代码。

5. 合图的对象填写的宽高必须是px，不能写得比图片大，如果比图片大ispriter会把它设置为原图大小

6. 没有合图的css文件，要拷贝过去（done），不用合图的照片要拷贝过去
7. @media 好像有问题
8. 注释css有问题
9. @import 支持or不支持


两个问题点：

缓存过 -》 cache -》cssRules合并
绘画过 -》 imageInfo.drew 

问题一 ： 缓存使用同一个imageInfo，没有drew带来的重绘png问题，但是cssRules被侮辱重复渲染
解决：cssRules使用隔壁特殊记录

问题二 ： 缓存使用clone imageInfo，没有cssRules带来的重复渲染，却会带来drew带来的 重复输出png 
解决：drew使用全局记录，但是保证不理imageInfo的统一性

问题根本
imageInfo的通用性，但是又需要cssRules的单独性

目前情况：使用imageInfo通用性的方案，带来的cssRules的className被重复渲染