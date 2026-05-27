# Netlify 免费部署步骤

这个项目已经整理成 Netlify 可部署结构，首页是 `index.html`，动态查询由 `netlify/functions/query.mjs` 处理，查询记录保存到 Netlify Blobs。

## 需要上传的文件

上传整个项目目录，但不要上传这些本地生成内容：

- `node_modules/`
- `.netlify/`
- `data/`

必须包含：

- `index.html`
- `styles.css`
- `app.js`
- `assets/brand-banner.png`
- `netlify.toml`
- `package.json`
- `netlify/functions/query.mjs`

`server.cjs` 是本地预览服务文件，可以一起上传，不会影响 Netlify 部署。

## 推荐部署方式：GitHub + Netlify

1. 注册或登录 Netlify。
2. 把当前项目上传到 GitHub 新仓库。
3. 在 Netlify 点击 `Add new site`，选择 `Import an existing project`。
4. 选择你的 GitHub 仓库。
5. 构建设置保持：
   - Build command: `npm run build`
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
6. 点击 `Deploy site`。
7. 等部署完成后，Netlify 会生成一个公网网址，例如：
   `https://your-site-name.netlify.app`

## 扫码访问链接格式

部署完成后，把二维码内容设置成：

```text
https://your-site-name.netlify.app/?code=FW202605270001&wx=wx001
```

其中：

- `code` 是防伪码
- `wx` 是微信身份标识

正式接微信公众号时，建议由后端通过微信 OAuth 获取 `openid`，不要让用户手动传 `wx`。

## 手机端

页面已经包含移动端视口配置和响应式样式，手机浏览器可直接访问 Netlify 公网地址。

## 注意

普通 Netlify 手动拖拽上传不会运行构建流程，动态函数可能无法正确部署。这个项目需要使用 GitHub 连续部署，或使用 Netlify CLI 部署。
