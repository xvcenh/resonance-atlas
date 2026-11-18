# 声纹沙盘 · Resonance Atlas

一台在浏览器中运行的克拉尼声纹实验台。调节两组模态和叠加强度，拨动沙粒，试听参考音，或导出带参数的 PNG。[打开实验](https://xvcenh.github.io/resonance-atlas/)

## 运行

双击 `index.html` 即可离线使用。也可在项目根目录执行 `python -m http.server 8080`，然后访问本机 8080 端口。网站使用原生 Canvas 2D 和 Web Audio，首次点击试听才创建音源。浏览器地址会记录模态、配色和叠加强度，可用于分享。

## 模型

在归一化方板上计算两组余弦驻波的差。沙粒沿局部位移平方的负梯度向节点聚集，叠加少量随机扰动。两模态相等且强度为一时，波形完全相消。参考音是模态到音高的映射，真实振板频率还取决于板材、尺寸和边界条件。

交互灵感来自 [Cymatics](https://github.com/evoluteur/cymatics) 的克拉尼振板，以及 [The Book of Shaders](https://thebookofshaders.com/09/) 的图案实验。本项目独立实现，字体许可位于 `fonts/`。
