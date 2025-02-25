/**
 * @name AutoDNDOnGame
 * @description Automatically set your status to Do Not Disturb when you launch a game
 * @version 1.0.4
 * @author Xenon Colt
 * @authorLink https://xenoncolt.me
 * @website https://github.com/xenoncolt/AutoDNDOnGame
 * @source https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js
 * @invite vJRe78YmN8
 */

const config = {
    main: "AutoDNDOnGame.plugin.js",
    id: "xenoncolt",
    name: "AutoDNDOnGame",
    author: "Xenon Colt",
    authorId: "709210314230726776",
    authorLink: "https://xenoncolt.me",
    version: "1.0.4",
    description: "Automatically set your status to Do Not Disturb when you launch a game",
    website: "https://xenoncolt.me",
    source: "https://github.com/xenoncolt/AutoDNDOnGame",
    invite: "vJRe78YmN8",
    info: {
        name: "AutoDNDOnGame",
        authors: [
            {
                name: "Xenon Colt",
                github_username: "xenoncolt",
                link: "https://xenoncolt.me"
            }
        ],
        version: "1.0.4",
        description: "Automatically set your status to Do Not Disturb when you launch a game",
        github: "https://github.com/xenoncolt/AutoDNDOnGame",
        invite: "vJRe78YmN8",
        github_raw: "https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js"
    },
    helpers: ":3",
    changelog: [
        {
            title: "Fixed Few Things",
            type: "fixed",
            items: [
                "Prevent plugin from breaking BD",
                "Prevent plugin from spamming status change",
                "Fixed status change limit not working",
                "Fixed where save settings not working",
            ]
        },
        {
            title: "Changed Few Things",
            type: "changed",
            items: [
                "Changed the way get to activities",
                "Changed the way to update status",
                "Instead of using own version manager use BD's Semver",
                "Changed the way to show changelog"
            ]
        }
    ],
    settingsPanel: [
        {
            type: "radio",
            name: "Change Status To:",
            note: "What status should be set when you launch a game?",
            id: "inGameStatus",
            value: () => settings.inGameStatus,
            options: [
                {
                    name: "Do Not Disturb",
                    value: "dnd"
                },
                {
                    name: "Invisible",
                    value: "invisible"
                },
                {
                    name: "Idle",
                    value: "idle"
                }
            ]
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "revertDelay",
            value: () => settings.revertDelay,
            min: 5,
            max: 120,
            units: "s",
            markers: [
                5,
                15,
                30,
                45,
                60,
                75,
                90,
                105,
                120
            ]
        },
        {
            type: "switch",
            name: "Show Notification",
            note: "Should the plugin show a notification when it changes your status?",
            id: "showToasts",
            value: () => settings.showToasts,
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "pollingInterval",
            value: () => settings.pollingInterval,
            min: 5000,
            max: 60000,
            units: "ms",
            markers: [
                5000,
                15000,
                30000,
                45000,
                60000
            ]
        }
    ]
};

let settings = {};

let defaultSettings = {
    inGameStatus: "dnd",
    revertDelay: 10,
    showToasts: true,
    pollingInterval: 5000
}

const { Webpack, UI, Logger, Data, Utils } = BdApi;


class AutoDNDOnGame {
    constructor() {
        this._config = config;
        //Save settings or load defaults
        this.settings = Data.load(this._config.name, "settings") || defaultSettings;
        this.getSettingsPanel();

        this.hasSetStatus = false;
        this.revertTimeoutId = null;
        this.statusChangeCount = 0;
        this.statusChangeThreshold = 5;
        this.statusChangeResetInterval = null;
        this.boundHandlePresenceChange = this.handlePresenceChange.bind(this);
        try {
            let currentVersionInfo = {};
            try {
                currentVersionInfo = Object.assign({}, { version: this._config.version, hasShownChangelog: false }, Data.load("AutoDNDOnGame", "currentVersionInfo"));
            } catch (err) {
                currentVersionInfo = { version: this._config.version, hasShownChangelog: false };
            }
            if (this._config.version != currentVersionInfo.version) currentVersionInfo.hasShownChangelog = false;
            currentVersionInfo.version = this._config.version;
            Data.save(this._config.name, "currentVersionInfo", currentVersionInfo);

            this.checkForUpdate();

            if (!currentVersionInfo.hasShownChangelog) {
                UI.showChangelogModal({
                    title: "AutoDNDOnGame Changelog",
                    subtitle: config.version,
                    changes: config.changelog
                });
                currentVersionInfo.hasShownChangelog = true;
                Data.save(this._config.name, "currentVersionInfo", currentVersionInfo);
            }
        }
        catch (err) {
            Logger.error(this._config.name, err);
        }
    }

    start() {
        settings = Object.assign({}, defaultSettings, Data.load(this._config.name, "settings"));

        // Retrieve the presence store from BdApi.Webpack
        this.presenceStore = Webpack.getStore("PresenceStore");
        this.CurrentUserStore = Webpack.getStore("UserStore");
        this.UserSettingsProtoStore = Webpack.getStore("UserSettingsProtoStore");
        if (!this.presenceStore) {
            UI.showToast("PresenceStore not found. The plugin cannot function properly.", { type: "error" });
            return;
        }

        this.presenceStore.addChangeListener(this.boundHandlePresenceChange);
        // this.pollingInterval = setInterval(() => this.handlePresenceChange(), this.settings.pollingInterval);

        this.saveAndUpdate();

        // Counting status change 
        this.statusChangeReset = setInterval(() => {
            this.statusChangeCount = 0;
            Logger.info(this._config.name, "Status change count reset");
        }, 10 * 60 * 1000);
    }

    stop() {
        if (this.presenceStore) {
            this.presenceStore.removeChangeListener(this.boundHandlePresenceChange);
        }
        if (this.revertTimeoutId) {
            clearTimeout(this.revertTimeoutId);
            this.revertTimeoutId = null;
        }
        if (this.statusChangeResetInterval) {
            clearInterval(this.statusChangeResetInterval);
            this.statusChangeResetInterval = null;
        }
        if (this.hasSetStatus) {
            this.updateStatus("online");
            this.hasSetStatus = false;
        }
    }

    getSettingsPanel() {
        return UI.buildSettingsPanel({
            settings: this._config.settingsPanel.map(setting => ({
                ...setting,
            value: () => this.settings[setting.id]
            })),
            onChange: (category, id, value) => {
                settings[id] = value;
                // Data.save(this._config.id, "settings", settings);
                this.saveAndUpdate();
            },
        });
    }

    saveAndUpdate() {
        Data.save(this._config.name, "settings", settings);
    }

    // Called when the presence changes.
    handlePresenceChange() {
        const currentUser = this.CurrentUserStore.getCurrentUser();
        if (!currentUser) return;
        const activities = this.presenceStore.getActivities(currentUser.id);
        // Debug log 
        // console.log("Presence changed. Activities:", activities);
        // Look for an activity of type 0 ("Playing") with a non-empty name.
        const isPlayingGame =
            Array.isArray(activities) &&
            activities.some(activity => activity.type === 0 && activity.name);
        if (isPlayingGame) {
            if (!this.hasSetStatus) {
                if (this.currentStatus() !== this.settings.inGameStatus) {
                    this.updateStatus(this.settings.inGameStatus);
                    this.hasSetStatus = true;
                    this.statusChangeCount++;
                    if (this.settings.showToasts) UI.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`);
                    if (this.revertTimeoutID) {
                        clearTimeout(this.revertTimeoutID);
                        this.revertTimeoutID = null;
                    }
                } else {
                    Logger.info(this._config.name, "Status change limit reached. Skipping status change");
                }
            }
        } else {
            if (this.hasSetStatus) {
                if (this.revertTimeoutID) clearTimeout(this.revertTimeoutID);
                this.revertTimeoutID = setTimeout(() => {
                    const updatedActivities = this.presenceStore.getActivities(currentUser.id);
                    const stillPlaying =
                        Array.isArray(updatedActivities) &&
                        updatedActivities.some(activity => activity.type === 0 && activity.name);
                    if (!stillPlaying) {
                        this.updateStatus("online");
                        this.hasSetStatus = false;
                        if (this.settings.showToasts) UI.showToast("No game detected. Reverting status to online.");
                    }
                }, this.settings.revertDelay * 1000);
            }
        }
    }

    currentStatus() {
        return this.UserSettingsProtoStore.settings.status.status.value;
    }

    // Update user status
    updateStatus(toStatus) {
        if (this.statusChangeCount >= this.statusChangeThreshold) {
            Logger.info(this._config.name, "Status change limit reached. Skipping status change");
            return;
        }

        const UserSettingsProtoUtils = Webpack.getModule(m => m.ProtoClass && m.ProtoClass.typeName.endsWith(".PreloadedUserSettings"), { first: true, searchExports: true });

        UserSettingsProtoUtils.updateAsync("status", statusSetting => {
            statusSetting.status.value = toStatus;
        }, 0);
    }

    async checkForUpdate() {
        try {
            let fileContent = await (await fetch(this._config.info.github_raw, { headers: { "User-Agent": "BetterDiscord" } })).text();
            let remoteMeta = this.parseMeta(fileContent);
            if (Utils.semverCompare(this._config.version, remoteMeta.version) > 0) {
                this.newUpdateNotify(remoteMeta, fileContent);
            }
        }
        catch (err) {
            Logger.error(this._config.name, err);
        }

    }

    newUpdateNotify(remoteMeta, remoteFile) {
        Logger.info(this._config.name, "A new update is available!");

        UI.showConfirmationModal("Update Available", [`Update ${remoteMeta.version} is now available for AutoDNDOnGame!`, "Press Download Now to update!"], {
            confirmText: "Download Now",
            onConfirm: async (e) => {
                if (remoteFile) {
                    await new Promise(r => require("fs").writeFile(require("path").join(BdApi.Plugins.folder, `${this._config.name}.plugin.js`), remoteFile, r));
                    try {
                        let currentVersionInfo = Data.load(this._config.name, "currentVersionInfo");
                        currentVersionInfo.hasShownChangelog = false;
                        Data.save(this._config.name, "currentVersionInfo", currentVersionInfo);
                    } catch (err) {
                        UI.showToast("An error occurred when trying to download the update!", { type: "error" });
                    }
                }
            }
        });
    }

    parseMeta(fileContent) {
        const meta = {};
        const regex = /@([a-zA-Z]+)\s+(.+)/g;
        let match;
        while ((match = regex.exec(fileContent)) !== null) {
            meta[match[1]] = match[2].trim();
        }
        return meta;
    }
}

module.exports = AutoDNDOnGame;
/*@end@*/