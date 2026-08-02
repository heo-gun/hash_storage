import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [react()],
    // amazon-cognito-identity-js 가 Node 의 `global` 을 참조한다. 프로덕션 번들은
    // `typeof global` 가드 덕에 살아남지만, dev 서버는 소스를 그대로 실행해서
    // App.tsx import 자체가 "global is not defined" 로 터진다.
    define: {
        global: "globalThis",
    },
});
