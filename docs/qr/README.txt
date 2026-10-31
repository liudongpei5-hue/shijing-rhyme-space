《诗经 · 声迹》网站二维码
======================================

编码 URL:
  https://liudongpei5-hue.github.io/shijing-rhyme-space/

生成时间:
  2026-10-31 14:49 (Asia/Shanghai)

文件清单:
  shijing-qr.png        1000 x 1000 px  PNG (深色底 #0b1315，金色模块 #f0e2b8，中心嵌「诗」字)
                        —— 海报 / 画册 / 手机扫码通用，打印建议不小于 2.5cm 边长
  shijing-qr.svg        矢量版（980 x 980 viewBox），无损缩放
                        —— 印刷 / 排版软件直接置入用
  shijing-qr-small.png  320 x 320 px PNG
                        —— 网页内嵌小图用
  index.html            深色风格预览页（浏览器打开本目录的 index.html 即可展示）

二维码参数:
  编码库        Python qrcode 8.2 (Pillow 13.0.0)
  纠错等级      H（可容忍约 30% 面积遮挡，足以承载中心「诗」字徽标）
  版本          6（41 x 41 模块 + 4 模块静区 = 49 模块）
  配色          模块 #f0e2b8 / 背景 #0b1315 / 徽标细环 #9ce4dc

生成命令（venv 内执行，不污染系统 python）:
  /Users/liudongpei/.workbuddy/binaries/python/envs/default/bin/python -m pip install "qrcode[pil]" pillow
  /Users/liudongpei/.workbuddy/binaries/python/envs/default/bin/python /tmp/gen_shijing_qr.py

校验结果（两套独立解码器均通过，内容与 URL 逐字符一致）:
  1) macOS Vision 框架（VNDetectBarcodesRequest，ObjC 命令行工具）:
     shijing-qr.png / shijing-qr-small.png 均解出目标 URL。
  2) zxing-cpp 3.1.1（Python 绑定）:
     shijing-qr.png / shijing-qr-small.png 直接解码 = 目标 URL；
     shijing-qr.svg 经 sips 光栅化后解码 = 目标 URL。

用途:
  海报、画册、PPT、展签等印刷物料印上本码，手机相机或微信扫一扫
  即可直达网站；网页中引用 ./qr/shijing-qr-small.png 作展示。
