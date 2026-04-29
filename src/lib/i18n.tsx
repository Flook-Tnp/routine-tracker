import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

type Language = 'en' | 'th';

const translations = {
  en: {
    // App.tsx
    'app.title': 'DISBY',
    'nav.tracker': 'Tracker',
    'nav.board': 'Board',
    'nav.rank': 'Rank',
    'nav.global': 'Community',
    'nav.pods': 'Groups',
    'nav.profile': 'Profile',
    'streak.daily': 'Daily',
    'streak.weekly': 'Weekly',
    'notifications.title': 'Notifications',
    'notifications.empty': 'No new notifications',
    'notifications.clear': 'Clear',
    'status.disconnected': 'Disconnected',
    'status.loading': 'Loading...',
    'auth.login_nav': 'Login',
    'auth.logout_nav': 'Log Out',
    'action.new_habit': 'New Habit...',
    'danger.zone': 'Danger Zone',
    'danger.delete': 'DELETE AND ALL HISTORY?',

    // Auth.tsx
    'auth.login.title': 'Log In',
    'auth.signup.title': 'Sign Up',
    'auth.login.subtitle': 'Welcome back!',
    'auth.signup.subtitle': 'Create a new account.',
    'auth.email': 'Email Address',
    'auth.password': 'Password',
    'auth.remember': 'Remember Me',
    'auth.btn.login': 'Log In',
    'auth.btn.signup': 'Sign Up',
    'auth.hint': 'Hint: Add to Home Screen...',
    'auth.processing': 'Processing...',
    'auth.error': 'Login failed.',
    'auth.success': 'Account created! Verify your email.',

    // Profile.tsx
    'profile.loading': 'Loading Profile...',
    'profile.zoom': 'Zoom',
    'profile.save_picture': 'Save Picture',
    'profile.cancel': 'Cancel',
    'profile.categories': 'Categories',
    'profile.achievements': 'Achievements',
    'profile.consistency': 'Consistency',
    'profile.experience': 'Experience',
    'profile.trophy_room': 'Trophy Room',
    'profile.logout': 'Log Out',
    'profile.no_badges': 'No badges yet',
    'profile.lifetime_xp': 'Lifetime XP',
    'profile.daily_streak': 'Daily Streak',
    'profile.weekly_streak': 'Weekly Streak',
    'profile.no_categories': 'No categories yet',
    'profile.close': 'Close',

    // KanbanBoard.tsx
    'board.loading': 'Loading Board...',
    'board.login_required': 'Login required to view the board',
    'board.login': 'Log In',

    // Leaderboard.tsx
    'leaderboard.title': 'Leaderboard',

    // SocialFeed.tsx
    'feed.title': 'Community Feed',
    'feed.share_streak': 'Share Streak',
    'feed.post': 'Post',
    'feed.placeholder': 'Share an achievement or thought...',

    // AccountabilityPods.tsx
    'pods.title': 'Accountability Groups',
    'pods.create': 'Create New Group',
    'pods.join': 'Join Group',
    
    // Other
    'common.confirm': 'Confirm',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.save': 'Save',
    'common.edit': 'Edit',

    'action.new_category': 'New Category',
    'action.enter_category_name': 'Enter category name...',
    'action.overall_total': 'Overall Total',
    'status.no_habits': 'No habits in {{category}}',
    'action.today': 'Today',

    'profile.saving': 'Saving...',
    'danger.delete_avatar': 'Are you sure you want to delete your profile picture?',
    'profile.anonymous': 'Anonymous User',
    'profile.requirement': 'Requirement',
    'profile.days': 'Days',
    'profile.unlocked': 'Unlocked',
    'profile.locked': 'Locked',
    'profile.edit_picture': 'Edit Picture',
    'action.back': 'Back',
    'action.reload': 'Reload',
    'action.exit': 'Exit',

    'board.title': 'Task Board',
    'board.subtitle': 'Manage Tasks',
    'board.new_task': 'New Task...',
    'board.col.todo': 'To Do',
    'board.col.in_progress': 'In Progress',
    'board.col.done': 'Done',
    'board.complete_task': 'Complete Task',
    'board.finalized': 'Finalized',
    'board.empty': 'Empty',

    'leaderboard.loading': 'Loading Rankings...',
    'leaderboard.subtitle': 'Rank',
    'leaderboard.rank': 'Rank',
    'leaderboard.user': 'User',
    'leaderboard.xp': 'XP',
    'leaderboard.total_xp': 'Total XP',

    'feed.loading': 'Loading Feed...',
    'feed.login_prompt': 'Log in to join the community',
    'feed.milestone': 'Milestone',
    'feed.add_comment': 'Add a comment...',
    'feed.empty': 'No posts yet',

    'pods.loading': 'Loading Groups...',
    'pods.squad_streak': 'Group Streak',
    'pods.established': 'Established',
    'pods.terminate': 'Delete Group',
    'pods.leave': 'Leave Group',
    'pods.missions': 'Missions',
    'pods.new_mission': 'New Mission...',
    'pods.establish': 'Create',
    'pods.add_mission': 'Add Mission',
    'pods.no_missions': 'No assigned missions',
    'pods.feed': 'Group Feed',
    'pods.vitals': 'Status',
    'pods.synced': 'Synced',
    'pods.offline': 'Offline',
    'pods.missions_count': 'Missions',
    'pods.subtitle': 'Overview',
    'pods.name_label': 'Group Name',
    'pods.desc_label': 'Description',
    'pods.btn_create': 'Create',
    'pods.members': 'Members',
    'pods.day_streak': 'Day Streak',
    'pods.enter': 'Enter Group',

    'danger.delete_category': 'Delete category "{{cat}}" and all history?',
    'danger.delete_routine': 'Delete "{{title}}" and all history?',

    'stats.progress': 'Progress',
    'stats.consistency': 'Consistency',
    'stats.perfect_days': 'Perfect Days',
    'stats.avg_efficiency': 'Average Efficiency',
    'stats.thirty_days': '30 Day Performance',
    'stats.lifetime': 'Lifetime Performance',
    'stats.total_days': 'Total Days Tracked',
    'chart.lifetime_analysis': 'Lifetime Data Analysis',

    'manual.title': 'User Manual',
    'manual.perf_logic': 'Performance Logic',
    'manual.interface': 'Interface Controls',
    'manual.data': 'Data Analytics',
    'manual.close': 'Close Manual'
  },
  th: {
    // App.tsx
    'app.title': 'DISBY',
    'nav.tracker': 'ติดตาม',
    'nav.board': 'กระดาน',
    'nav.rank': 'อันดับ',
    'nav.global': 'ชุมชน',
    'nav.pods': 'กลุ่ม',
    'nav.profile': 'โปรไฟล์',
    'streak.daily': 'รายวัน',
    'streak.weekly': 'รายสัปดาห์',
    'notifications.title': 'การแจ้งเตือน',
    'notifications.empty': 'ไม่มีการแจ้งเตือนใหม่',
    'notifications.clear': 'ล้าง',
    'status.disconnected': 'ตัดการเชื่อมต่อ',
    'status.loading': 'กำลังโหลด...',
    'auth.login_nav': 'เข้าสู่ระบบ',
    'auth.logout_nav': 'ออกจากระบบ',
    'action.new_habit': 'นิสัยใหม่...',
    'danger.zone': 'พื้นที่อันตราย',
    'danger.delete': 'ลบและประวัติทั้งหมด?',

    // Auth.tsx
    'auth.login.title': 'เข้าสู่ระบบ',
    'auth.signup.title': 'สมัครสมาชิก',
    'auth.login.subtitle': 'ยินดีต้อนรับกลับ!',
    'auth.signup.subtitle': 'สร้างบัญชีใหม่',
    'auth.email': 'อีเมล',
    'auth.password': 'รหัสผ่าน',
    'auth.remember': 'จดจำฉัน',
    'auth.btn.login': 'เข้าสู่ระบบ',
    'auth.btn.signup': 'สมัครสมาชิก',
    'auth.hint': 'คำแนะนำ: เพิ่มไปที่หน้าจอหลัก เพื่อประสบการณ์ที่ดีที่สุด',
    'auth.processing': 'กำลังดำเนินการ...',
    'auth.error': 'เข้าสู่ระบบล้มเหลว',
    'auth.success': 'สร้างบัญชีแล้ว! โปรดยืนยันอีเมลของคุณ',

    // Profile.tsx
    'profile.loading': 'กำลังโหลดโปรไฟล์...',
    'profile.zoom': 'ซูม',
    'profile.save_picture': 'บันทึกรูปภาพ',
    'profile.cancel': 'ยกเลิก',
    'profile.categories': 'หมวดหมู่',
    'profile.achievements': 'ความสำเร็จ',
    'profile.consistency': 'ความสม่ำเสมอ',
    'profile.experience': 'ประสบการณ์',
    'profile.trophy_room': 'ห้องถ้วยรางวัล',
    'profile.logout': 'ออกจากระบบ',
    'profile.no_badges': 'ยังไม่มีเหรียญตรา',
    'profile.lifetime_xp': 'XP ตลอดชีพ',
    'profile.daily_streak': 'สตรีครายวัน',
    'profile.weekly_streak': 'สตรีครายสัปดาห์',
    'profile.no_categories': 'ยังไม่มีหมวดหมู่',
    'profile.close': 'ปิด',

    // KanbanBoard.tsx
    'board.loading': 'กำลังโหลดกระดาน...',
    'board.login_required': 'ต้องเข้าสู่ระบบเพื่อดูกระดาน',
    'board.login': 'เข้าสู่ระบบ',

    // Leaderboard.tsx
    'leaderboard.title': 'กระดานผู้นำ',

    // SocialFeed.tsx
    'feed.title': 'ฟีดชุมชน',
    'feed.share_streak': 'แชร์สตรีค',
    'feed.post': 'โพสต์',
    'feed.placeholder': 'แบ่งปันความสำเร็จหรือความคิด...',

    // AccountabilityPods.tsx
    'pods.title': 'กลุ่มเพื่อนร่วมเป้าหมาย',
    'pods.create': 'สร้างกลุ่มใหม่?',
    'pods.join': 'เข้าร่วมกลุ่ม',

    // Other
    'common.confirm': 'ยืนยัน',
    'common.cancel': 'ยกเลิก',
    'common.delete': 'ลบ',
    'common.save': 'บันทึก',
    'common.edit': 'แก้ไข',

    'action.new_category': 'หมวดหมู่ใหม่',
    'action.enter_category_name': 'ใส่ชื่อหมวดหมู่...',
    'action.overall_total': 'ยอดรวมทั้งหมด',
    'status.no_habits': 'ไม่มีนิสัยใน {{category}}',
    'action.today': 'วันนี้',

    'profile.saving': 'กำลังบันทึก...',
    'danger.delete_avatar': 'คุณแน่ใจหรือไม่ว่าต้องการลบรูปโปรไฟล์?',
    'profile.anonymous': 'ผู้ใช้ไม่ระบุชื่อ',
    'profile.requirement': 'เงื่อนไข',
    'profile.days': 'วัน',
    'profile.unlocked': 'ปลดล็อคแล้ว',
    'profile.locked': 'ล็อค',
    'profile.edit_picture': 'แก้ไขรูปภาพ',
    'action.back': 'กลับ',
    'action.reload': 'โหลดใหม่',
    'action.exit': 'ออก',

    'board.title': 'กระดานงาน',
    'board.subtitle': 'จัดการงาน',
    'board.new_task': 'งานใหม่...',
    'board.col.todo': 'สิ่งที่ต้องทำ',
    'board.col.in_progress': 'กำลังทำ',
    'board.col.done': 'เสร็จสิ้น',
    'board.complete_task': 'ทำเสร็จ',
    'board.finalized': 'สรุปแล้ว',
    'board.empty': 'ว่างเปล่า',

    'leaderboard.loading': 'กำลังโหลดอันดับ...',
    'leaderboard.subtitle': 'อันดับ',
    'leaderboard.rank': 'อันดับ',
    'leaderboard.user': 'ผู้ใช้',
    'leaderboard.xp': 'XP',
    'leaderboard.total_xp': 'XP รวม',

    'feed.loading': 'กำลังโหลดฟีด...',
    'feed.login_prompt': 'เข้าสู่ระบบเพื่อเข้าร่วม',
    'feed.milestone': 'ความสำเร็จ',
    'feed.add_comment': 'เพิ่มความคิดเห็น...',
    'feed.empty': 'ยังไม่มีโพสต์',

    'pods.loading': 'กำลังโหลดกลุ่ม...',
    'pods.squad_streak': 'สตรีคของกลุ่ม',
    'pods.established': 'สร้างเมื่อ',
    'pods.terminate': 'ลบกลุ่ม',
    'pods.leave': 'ออกจากกลุ่ม',
    'pods.missions': 'ภารกิจ',
    'pods.new_mission': 'ภารกิจใหม่...',
    'pods.establish': 'สร้าง',
    'pods.add_mission': 'เพิ่มภารกิจ',
    'pods.no_missions': 'ไม่มีภารกิจที่ได้รับมอบหมาย',
    'pods.feed': 'ฟีดของกลุ่ม',
    'pods.vitals': 'สถานะ',
    'pods.synced': 'ซิงค์แล้ว',
    'pods.offline': 'ออฟไลน์',
    'pods.missions_count': 'ภารกิจ',
    'pods.subtitle': 'ภาพรวม',
    'pods.name_label': 'ชื่อกลุ่ม',
    'pods.desc_label': 'คำอธิบาย',
    'pods.btn_create': 'สร้าง',
    'pods.members': 'สมาชิก',
    'pods.day_streak': 'สตรีควัน',
    'pods.enter': 'เข้าสู่กลุ่ม',

    'danger.delete_category': 'ลบหมวดหมู่ "{{cat}}" และประวัติทั้งหมดหรือไม่?',
    'danger.delete_routine': 'ลบ "{{title}}" และประวัติทั้งหมดหรือไม่?',

    'manual.title': 'คู่มือการใช้งาน',
    'manual.perf_logic': 'ตรรกะผลงาน',
    'manual.interface': 'คำสั่งอินเทอร์เฟซ',
    'manual.data': 'การวิเคราะห์ข้อมูล',
    'manual.close': 'ปิดคู่มือ'
  }
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' || saved === 'th') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: string, params?: Record<string, string>): string => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    // Attempt flat key first, then nested
    if ((translations[language] as any)[key]) {
      value = (translations[language] as any)[key];
    } else {
      // Nested object fallback
      for (const k of keys) {
        if (value && value[k]) {
          value = value[k];
        } else {
          value = key;
          break;
        }
      }
    }

    // Fallback to English if translation is missing in current language
    if (!value || value === key) {
      value = (translations['en'] as any)[key] || key;
    }

    if (typeof value === 'string' && params) {
      return Object.keys(params).reduce((str, paramKey) => {
        return str.replace(new RegExp(`{{${paramKey}}}`, 'g'), params[paramKey]);
      }, value);
    }
    
    return typeof value === 'string' ? value : key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used within an I18nProvider');
  }
  return context;
};