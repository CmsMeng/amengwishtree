#!/bin/bash
# 许愿树 PWA 一键构建+部署脚本
# 用法：bash deploy.sh "更新说明"

set -e

MSG=${1:-"更新许愿树"}

echo "🔨 构建中..."
node build.js

echo "📦 准备部署..."
mkdir -p .deploy
cp dist/wish-tree.html .deploy/index.html

cd .deploy

if [ ! -d .git ]; then
  git init
  git remote add origin https://github.com/CmsMeng/amengwishtree.git
fi

git checkout -B gh-pages
git add index.html
git commit -m "$MSG" || echo "无变更，跳过"
git push -u origin gh-pages --force

cd ..
echo ""
echo "✅ 已部署到 https://cmsmeng.github.io/amengwishtree/"
echo "📋 提交信息: $MSG"
echo "⏳ GitHub Pages 约 1-2 分钟后更新"
