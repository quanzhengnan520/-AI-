# 09｜开发前应复核的官方资料（核验时间：2026-11-15）

这些是**第三方文档指引，不代表本项目已测试成功**。Expo SDK / Apple 政策和价格可能变化，Codex 需以创建项目时兼容的当前文档确认。

1. Expo Audio（包含 `enableBackgroundRecording`、持久 document 目录、iOS 运行时录音模式）：https://docs.expo.dev/versions/latest/sdk/audio/
2. Expo 开发版与原生插件重建：https://docs.expo.dev/develop/development-builds/use-development-builds/
3. Expo iOS 真机云构建：https://docs.expo.dev/tutorial/eas/ios-development-build-for-devices/
4. Expo 内部分发 Ad Hoc 与设备注册：https://docs.expo.dev/tutorial/eas/internal-distribution-builds/
5. Expo SecureStore 只适合少量令牌/秘密：https://docs.expo.dev/versions/latest/sdk/securestore/
6. Expo SQLite：https://docs.expo.dev/versions/latest/sdk/sqlite/
7. Expo Notifications：https://docs.expo.dev/versions/latest/sdk/notifications/
8. Expo 通知交付与 iOS 后台限制：https://docs.expo.dev/push-notifications/what-you-need-to-know/
9. Apple Developer 计划订阅：https://developer.apple.com/help/account/membership/program-enrollment/
10. Apple App Review（2.5.4、2.5.14、5.1等）：https://developer.apple.com/app-store/review/guidelines/
11. Expo App Intents（用于快捷指令/操作按钮探索；目前是 alpha，**非 POC 前置需求**）：https://docs.expo.dev/versions/latest/sdk/app-intents/

**重要纠偏**：`Expo Go` 并不等于可验证所有原生能力；**后台录音测试应以配置正确并安装的开发构建为准**；独立硬件的蜂窝网络可靠性不能由 iPhone 手机联网替代验证。
