import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "./", // Ensures correct asset paths
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        header: resolve(__dirname, "landing_pages/components/header.html"),
        logoutt: resolve(__dirname, "landing_pages/components/logout.html"),
        notifications: resolve(__dirname, "landing_pages/components/notifications.html"),

        adminlogin: resolve(__dirname, "landing_pages/admin/admin_navbar.html"),
        admindash: resolve(__dirname, "landing_pages/admin/admin_dash.html"),
        adminuser: resolve(__dirname, "landing_pages/admin/admin_users.html"),
        adminprojectlist: resolve(__dirname, "landing_pages/admin/admin_projects_list.html"),
        adminprojectedit: resolve(__dirname, "landing_pages/admin/admin_projects_edit.html"),
        adminprojecthistory: resolve(__dirname, "landing_pages/admin/admin_projects_history.html"),
        admintask: resolve(__dirname, "landing_pages/admin/predefined_task.html"),

        
        

      },
    },
  },
});