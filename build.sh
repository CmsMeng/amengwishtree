#!/bin/bash
# 许愿树 PWA 构建脚本
set -e
echo "🔨 构建许愿树 PWA..."
node "$(dirname "$0")/build.js"
