import type { AppT } from "@/i18n/i18n";

/**
 * Strings for the settings islands, translated on the server (ADR-0009).
 * Keys are written out in full so `pnpm i18n:check` sees them. Placeholders
 * left as `{name}` are filled on the client with `fill()`.
 */
export function settingsStrings(t: AppT) {
  return {
    sections: {
      profile: t("settings:sections.profile"),
      preferences: t("settings:sections.preferences"),
      privacy: t("settings:sections.privacy"),
      account: t("settings:sections.account"),
    },
    saved: t("settings:saved"),
    saveFailed: t("settings:saveFailed"),
    profile: {
      avatar: t("settings:profile.avatar"),
      initials: t("settings:profile.initials"),
      presets: t("settings:profile.presets"),
      preset: t("settings:profile.preset", { number: "{number}" }),
      upload: t("settings:profile.upload"),
      uploadHint: t("settings:profile.uploadHint"),
      uploadLocked: t("settings:profile.uploadLocked"),
      uploading: t("settings:profile.uploading"),
      uploadInvalid: t("settings:profile.uploadInvalid"),
      nicknameHint: t("settings:profile.nicknameHint"),
      nicknameCooldown: t("settings:profile.nicknameCooldown", { date: "{date}" }),
      country: t("settings:profile.country"),
      countryNone: t("settings:profile.countryNone"),
      bio: t("settings:profile.bio"),
      bioHint: t("settings:profile.bioHint"),
      bioBlocked: t("settings:profile.bioBlocked"),
      save: t("settings:profile.save"),
      view: t("settings:profile.view"),
    },
    preferences: {
      sound: t("settings:preferences.sound"),
      master: t("settings:preferences.master"),
      music: t("settings:preferences.music"),
      effects: t("settings:preferences.effects"),
      haptics: t("settings:preferences.haptics"),
      hapticsHint: t("settings:preferences.hapticsHint"),
      motion: t("settings:preferences.motion"),
      motionSystem: t("settings:preferences.motionSystem"),
      motionReduce: t("settings:preferences.motionReduce"),
      motionFull: t("settings:preferences.motionFull"),
      gamesHint: t("settings:preferences.gamesHint"),
    },
    privacy: {
      messages: t("settings:privacy.messages"),
      invites: t("settings:privacy.invites"),
      everyone: t("settings:privacy.everyone"),
      friends: t("settings:privacy.friends"),
      nobody: t("settings:privacy.nobody"),
      showOnline: t("settings:privacy.showOnline"),
      showInLeaderboards: t("settings:privacy.showInLeaderboards"),
    },
    account: {
      email: t("settings:account.email"),
      newEmail: t("settings:account.newEmail"),
      changeEmail: t("settings:account.changeEmail"),
      emailSent: t("settings:account.emailSent", { email: "{email}" }),
      changePassword: t("settings:account.changePassword"),
      passwordChanged: t("settings:account.passwordChanged"),
      reauth: t("settings:account.reauth"),
      methods: t("settings:account.methods"),
      connect: t("settings:account.connect"),
      disconnect: t("settings:account.disconnect"),
      lastMethod: t("settings:account.lastMethod"),
      emailMethod: t("settings:account.emailMethod"),
      signOut: t("settings:account.signOut"),
      signOutEverywhere: t("settings:account.signOutEverywhere"),
    },
    data: {
      download: t("settings:data.download"),
      downloadHint: t("settings:data.downloadHint"),
      downloadFailed: t("settings:data.downloadFailed"),
      delete: t("settings:data.delete"),
      deleteWarning: t("settings:data.deleteWarning"),
      deleteConfirm: t("settings:data.deleteConfirm"),
      keep: t("settings:data.keep"),
      pending: t("settings:data.pending", { date: "{date}" }),
      cancel: t("settings:data.cancel"),
    },
  };
}

export type SettingsStrings = ReturnType<typeof settingsStrings>;
