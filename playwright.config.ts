import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'tests',workers:1,timeout:45000,use:{baseURL:'http://127.0.0.1:5173/spray-net-review-portal/',trace:'retain-on-failure'},reporter:[['list'],['html',{open:'never'}]],projects:[{name:'chromium',use:{...devices['Pixel 7']}},{name:'webkit',use:{...devices['iPhone 13']}}]});
