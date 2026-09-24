// Email content for the three messages the app sends. Kept short and plain:
// authentication mail with little marketing text is less likely to land in spam.
// Each builder returns { subject, html, text, attachments } for lib/email/send.js.
//
// Email clients ignore <style> blocks and scripts, so everything is inline
// styles on tables (the layout that works in Gmail, Outlook and Apple Mail).
// A real "copy" button is impossible in email (no JavaScript); instead the code
// is plain contiguous digits, which lets Gmail show its own "코드 복사" chip and
// iOS / macOS offer it as AutoFill, and one tap selects the whole code in
// clients that support user-select.

import { LOGO_HEIGHT, LOGO_PNG_BASE64, LOGO_WIDTH } from "./logo";

const COLORS = { ink: "#18181b", muted: "#52525b", faint: "#a1a1aa", line: "#e4e4e7", page: "#f4f4f5", card: "#ffffff" };
const FONT = "-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const MONO = "'SFMono-Regular',Menlo,Consolas,'Liberation Mono',monospace";

/** The Elice logo travels inside the email (cid), so no image hosting is needed. */
const LOGO_ATTACHMENT = {
  filename: "elice-logo.png",
  content: LOGO_PNG_BASE64,
  encoding: "base64",
  cid: "elice-logo",
  contentType: "image/png",
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/**
 * Card layout: logo, title, body, footer.
 * `preheader` is the grey preview line inbox lists show next to the subject.
 */
function layout({ title, preheader, body }) {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background:${COLORS.page}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.page}">
<tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${COLORS.card};border-radius:16px;font-family:${FONT};color:${COLORS.ink}">
    <tr><td style="padding:28px 32px 0">
      <img src="cid:elice-logo" width="${LOGO_WIDTH}" height="${LOGO_HEIGHT}" alt="elice" style="display:block;border:0;outline:none">
    </td></tr>
    <tr><td style="padding:24px 32px 8px">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.4;font-weight:700">${escapeHtml(title)}</h1>
      ${body}
    </td></tr>
    <tr><td style="padding:16px 32px 28px">
      <p style="margin:0;padding-top:16px;border-top:1px solid ${COLORS.line};font-size:12px;line-height:1.6;color:${COLORS.faint}">
        엘리스 지역 특화 프로젝트 1:1 멘토링 예약 · 이 메일은 발신 전용이에요.
      </p>
    </td></tr>
  </table>
</td></tr>
</table>
</body></html>`;
}

const paragraph = (text) => `<p style="margin:0 0 20px;font-size:15px;line-height:1.6">${escapeHtml(text)}</p>`;
const note = (text) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:${COLORS.muted}">${escapeHtml(text)}</p>`;

/** Dark pill button (a table cell, so Outlook keeps the shape). */
function button(label, href) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td style="border-radius:999px;background:${COLORS.ink}">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${escapeHtml(label)}</a>
    </td></tr></table>`;
}

function linkEmail({ subject, title, intro, buttonLabel, link, notes }) {
  const safeLink = escapeHtml(link);
  const body =
    paragraph(intro) +
    button(buttonLabel, link) +
    notes.map(note).join("") +
    note("버튼이 눌리지 않으면 아래 주소를 브라우저에 붙여넣어 주세요.") +
    `<p style="margin:0 0 8px;font-size:12px;line-height:1.5;word-break:break-all"><a href="${safeLink}" style="color:${COLORS.muted}">${safeLink}</a></p>`;
  return {
    subject,
    html: layout({ title, preheader: intro, body }),
    text: [intro, `${buttonLabel}: ${link}`, ...notes].join("\n\n"),
    attachments: [LOGO_ATTACHMENT],
  };
}

/**
 * One-time code for sign-up. The code is also in the subject so it shows in
 * the phone notification and mail apps can detect it. `verifyUrl` is the
 * "인증 코드 입력" page, for students who open the email later or elsewhere.
 */
export function signupCodeEmail(code, verifyUrl) {
  const safeCode = escapeHtml(code);
  const intro = "아래 인증 코드를 '인증 코드 입력' 화면에 입력하면 회원가입이 끝나요.";
  const notes = [
    "코드는 한 번만 쓸 수 있고, 시간이 지나면 만료돼요. 만료됐다면 회원가입 화면에서 '코드 다시 받기'를 눌러주세요.",
    "본인이 요청하지 않았다면 이 메일은 무시해도 괜찮아요.",
  ];
  const body =
    paragraph(intro) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr>
      <td align="center" style="padding:18px 12px;background:${COLORS.page};border:1px solid ${COLORS.line};border-radius:12px;font-family:${MONO};font-size:34px;font-weight:700;letter-spacing:6px;color:${COLORS.ink};user-select:all;-webkit-user-select:all">${safeCode}</td>
    </tr></table>` +
    `<p style="margin:0 0 20px;font-size:12px;line-height:1.6;color:${COLORS.faint};text-align:center">코드를 눌러 선택하고 복사해서 붙여넣어 주세요.</p>` +
    button("인증 코드 입력하기", verifyUrl) +
    notes.map(note).join("");
  return {
    subject: `[멘토링 예약] 인증 코드 ${code}`,
    html: layout({ title: "이메일 인증 코드", preheader: `인증 코드 ${code}`, body }),
    text: [intro, `인증 코드: ${code}`, `인증 코드 입력하기: ${verifyUrl}`, ...notes].join("\n\n"),
    attachments: [LOGO_ATTACHMENT],
  };
}

/** Mentor / admin invitation: sets a password on first visit. */
export function invitationEmail(link) {
  return linkEmail({
    subject: "[멘토링 예약] 계정 활성화 안내",
    title: "멘토링 예약 계정 활성화",
    intro: "운영진이 멘토링 예약 계정을 만들었어요. 아래 버튼을 눌러 비밀번호를 정하면 바로 시작할 수 있어요.",
    buttonLabel: "비밀번호 설정하기",
    link,
    notes: [
      "링크는 한 번만 쓸 수 있고, 연 뒤 15분 안에 비밀번호를 정해야 해요.",
      "만료됐다면 로그인 화면의 '비밀번호 찾기'로 새 링크를 받을 수 있어요.",
    ],
  });
}

/** "비밀번호 찾기". */
export function passwordResetEmail(link) {
  return linkEmail({
    subject: "[멘토링 예약] 비밀번호 재설정",
    title: "비밀번호 재설정",
    intro: "아래 버튼을 눌러 새 비밀번호를 정해주세요.",
    buttonLabel: "새 비밀번호 정하기",
    link,
    notes: [
      "링크는 한 번만 쓸 수 있고, 연 뒤 15분 안에 비밀번호를 정해야 해요.",
      "본인이 요청하지 않았다면 이 메일은 무시해도 괜찮아요. 비밀번호는 바뀌지 않아요.",
    ],
  });
}
