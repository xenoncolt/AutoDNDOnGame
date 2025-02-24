/**
 * @name AutoDNDOnGame
 * @description Automatically set your status to Do Not Disturb when you launch a game
 * @version 1.0.0
 * @author Xenon Colt
 * @authorLink https://xenoncolt.me
 * @website https://github.com/xenoncolt/AutoDNDOnGame
 * @source https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js
 * @invite vJRe78YmN8
 */

const config = {
    main: "index.js",
    id: "xenoncolt",
    name: "AutoDNDOnGame",
    author: "Xenon Colt",
    authorId: "709210314230726776",
    authorLink: "https://xenoncolt.me",
    version: "1.0.0",
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
        version: "1.0.0",
        description: "Automatically set your status to Do Not Disturb when you launch a game",
        github: "https://github.com/xenoncolt/AutoDNDOnGame",
        invite: "vJRe78YmN8",
        github_raw: "https://raw.githubusercontent.com/xenoncolt/AutoDNDOnGame/main/AutoDNDOnGame.plugin.js"
    },
    helpers: ":3",
    changelog: [
        {
            title: "Fixed Deprecated Function Usage",
            type: "fixed",
            items: [
                "Fixed deprecated function usage in the plugin"
            ]
        }
    ],
    defaultConfig: [
        {
            type: "radio",
            name: "Change Status To:",
            note: "What status should be set when you launch a game?",
            id: "inGameStatus",
            value: "dnd",
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
            defaultValue: 10,
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
            value: true,
            defaultValue: true
        },
        {
            type: "slider",
            name: "Back to Online Delay:",
            note: "How long should the plugin wait before setting your status back to online after you close a game?",
            id: "pollingInterval",
            defaultValue: 5000,
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

const { Webpack, Patcher, Net, React, UI, Logger, Data, Components, DOM } = BdApi;


class AutoDNDOnGame {
    constructor() {
        this._config = config;
        //Save settings or load defaults
        this.settings = BdApi.loadData(this._config.name, "settings") || {
            inGameStatus: "dnd",
            revertDelay: 10,
            showToasts: true,
            pollingInterval: 5000
        };
        
        this.hasSetStatus = false;
        this.revertTimeoutId = null;
        this.boundHandlePresenceChange = this.handlePresenceChange.bind(this);
    }

    getName() {
        return this._config.info.name;
    }

    getVersion() {
        return this._config.info.version;
    }

    getAuthor() {
        return this._config.info.authors[0].name;
    }

    getDescription() {
        return this._config.info.description;
    }

    load() { }

    start() {
        // Auto-update check using BdApi.request
        this.checkForUpdate();
        // Show changelog modal if version changed
        this.showChangelog();

        // Retrieve the presence store from BdApi.Webpack
        this.presenceStore = Webpack.getStore("PresenceStore");
        if (!this.presenceStore) {
            UI.showToast("PresenceStore not found. The plugin cannot function properly.", { type: "error" });
            return;
        }

        this.presenceStore.addChangeListener(this.boundHandlePresenceChange);
        // this.pollingInterval = setInterval(() => this.handlePresenceChange(), this.settings.pollingInterval);
    }

    stop() {
        if (this.presenceStore) {
            this.presenceStore.removeChangeListener(this.boundHandlePresenceChange);
        }
        if (this.revertTimeoutId) {
            clearTimeout(this.revertTimeoutId);
            this.revertTimeoutId = null;
        }
        if (this.hasSetStatus) {
            this.updateStatus("online");
            this.hasSetStatus = false;
        }
        // if (this.pollingInterval) {
        //     clearInterval(this.pollingInterval);
        //     this.pollingInterval = null;
        // }
    }

    getSettingsPanel() {
        // const panel = document.createElement("div");
        // panel.style.padding = "10px";

        // // Dropdown
        // const statusLabel = document.createElement("label");
        // statusLabel.textContent = "In-Game Status: ";
        // const statusSelect = document.createElement("select");
        // ["dnd", "idle", "invisible"].forEach(optionValue => {
        //     const option = document.createElement("option");
        //     option.value = optionValue;
        //     option.textContent = optionValue.toUpperCase();
        //     if (this.settings.inGameStatus === optionValue) option.selected = true;
        //     statusSelect.appendChild(option);
        // });
        // statusSelect.addEventListener("change", e => {
        //     this.settings.inGameStatus = e.target.value;
        //     BdApi.saveData(this._config.name, "settings", this.settings);
        // });
        // panel.appendChild(statusLabel);
        // panel.appendChild(statusSelect);
        // panel.appendChild(document.createElement("br"));
        // panel.appendChild(document.createElement("br"));

        // // Show Toasts Setting (Checkbox)
        // const toastLabel = document.createElement("label");
        // toastLabel.textContent = "Show Toasts: ";
        // const toastCheckbox = document.createElement("input");
        // toastCheckbox.type = "checkbox";
        // toastCheckbox.checked = this.settings.showToasts;
        // toastCheckbox.addEventListener("change", e => {
        //     this.settings.showToasts = e.target.checked;
        //     BdApi.saveData(this._config.id, "settings", this.settings);
        // });
        // panel.appendChild(toastLabel);
        // panel.appendChild(toastCheckbox);

        // return panel;
        return UI.buildSettingsPanel({
            settings: this._config.defaultConfig,
            onChange: (category, id, value) => console.log(category, id, value),
        });
    }

    // Called when the presence changes.
    handlePresenceChange() {
        const CurrentUserStore = Webpack.getModule((m) => m?.getCurrentUser, {
            first: true,
        });
        if (!CurrentUserStore) return;
        const currentUser = CurrentUserStore.getCurrentUser();
        if (!currentUser) return;
        const activities = this.presenceStore.getActivities(currentUser.id);
        // Debug log 
        // console.log("Presence changed. Activities:", activities);
        // Look for an activity of type 0 ("Playing") with a non-empty name.
        const isPlayingGame =
            Array.isArray(activities) &&
            activities.some(activity => activity.type === 0 && activity.name);
        if (isPlayingGame) {
            if (this.currentStatus() !== this.settings.inGameStatus) {
                this.updateStatus(this.settings.inGameStatus);
                this.hasSetStatus = true;
                if (this.settings.showToasts) UI.showToast(`Game detected. Changing status to ${this.settings.inGameStatus}`);
                if (this.revertTimeoutID) {
                    clearTimeout(this.revertTimeoutID);
                    this.revertTimeoutID = null;
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
        const UserSettingsProtoStore = Webpack.getModule(
            m => m && typeof m.getName === "function" && m.getName() === "UserSettingsProtoStore",
            { first: true, searchExports: true }
        );
        return UserSettingsProtoStore.settings.status.status.value;
    }

    // Update user status
    updateStatus(toStatus) {
        const UserSettingsProtoUtils = Webpack.getModule(
            m => m.ProtoClass && m.ProtoClass.typeName.endsWith(".PreloadedUserSettings"),
            { first: true, searchExports: true }
        );
        UserSettingsProtoUtils.updateAsync("status", statusSetting => {
            statusSetting.status.value = toStatus;
        }, 0);
    }


    checkForUpdate() {
        fetch(this._config.info.github_raw, { headers: { "User-Agent": "BetterDiscord" } })
            .then(response => response.text())
            .then(text => {
                const versionMatch = text.match(/@version\s+([^\s]+)/);
                if (versionMatch) {
                    const latestVersion = versionMatch[1].trim();
                    if (this.versionCompare(latestVersion, this.getVersion()) > 0) {
                        UI.showConfirmationModal("Update Available", `A new version (${latestVersion}) is available. Would you like to update?`, {
                            confirmText: "Update",
                            cancelText: "Later",
                            onConfirm: () => {
                                require("electron").shell.openExternal(this._config.info.github_raw);
                            }
                        });
                    }
                }
            })
            .catch(err => {
                console.error("Failed to check for updates:", err);
            });
    }

    // Compare semantic version strings.
    versionCompare(v1, v2) {
        const v1parts = v1.split('.').map(Number);
        const v2parts = v2.split('.').map(Number);
        for (let i = 0; i < Math.max(v1parts.length, v2parts.length); i++) {
            const a = v1parts[i] || 0;
            const b = v2parts[i] || 0;
            if (a > b) return 1;
            if (a < b) return -1;
        }
        return 0;
    }

    // Show changelog modal if the saved version differs from the current.
    showChangelog() {
        const savedVersion = BdApi.loadData(this._config.id, "version");
        if (savedVersion !== this.getVersion()) {
            UI.showChangelogModal(this.getName(), this.getVersion(), this._config.changelog);
            BdApi.saveData(this._config.id, "version", this.getVersion());
        }
    }
}

module.exports = AutoDNDOnGame;
/*@end@*/