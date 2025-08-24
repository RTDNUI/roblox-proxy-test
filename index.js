const axios = require('axios');
const inquirer = require('inquirer');
const chalk = require('chalk');

class RobloxPlayerLookup {
    constructor() {
        this.baseURL = 'https://users.roblox.com/v1/users';
    }

    async getUserInfo(userId) {
        try {
            console.log(chalk.blue(`Fetching information for user ID: ${userId}...`));
            
            const response = await axios.get(`${this.baseURL}/${userId}`);
            const userData = response.data;

            return {
                success: true,
                data: {
                    userId: userData.id,
                    username: userData.name,
                    displayName: userData.displayName,
                    description: userData.description || 'No description available',
                    created: new Date(userData.created).toLocaleDateString(),
                    isBanned: userData.isBanned,
                    profileLink: `https://www.roblox.com/users/${userId}/profile`,
                    avatarLink: `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`
                }
            };
        } catch (error) {
            if (error.response?.status === 404) {
                return {
                    success: false,
                    error: 'User not found. Please check the User ID.'
                };
            } else if (error.response?.status === 400) {
                return {
                    success: false,
                    error: 'Invalid User ID format.'
                };
            } else {
                return {
                    success: false,
                    error: `API Error: ${error.message}`
                };
            }
        }
    }

    async getAdditionalInfo(userId) {
        try {
            const [presence, badges] = await Promise.allSettled([
                axios.post('https://presence.roblox.com/v1/presence/users', {
                    userIds: [parseInt(userId)]
                }),
                axios.get(`https://badges.roblox.com/v1/users/${userId}/badges?limit=5`)
            ]);

            const additionalInfo = {};

            if (presence.status === 'fulfilled') {
                const presenceData = presence.value.data;
                additionalInfo.presence = presenceData.userPresences[0] || { userPresenceType: 'Offline' };
            }

            if (badges.status === 'fulfilled') {
                const badgesData = badges.value.data;
                additionalInfo.badges = {
                    count: badgesData.data.length,
                    recent: badgesData.data.slice(0, 3).map(badge => badge.name)
                };
            }

            return additionalInfo;
        } catch (error) {
            console.log(chalk.yellow('Could not fetch additional information'));
            return {};
        }
    }

    displayPlayerInfo(userInfo, additionalInfo = {}) {
        console.log('\n' + chalk.green('='.repeat(50)));
        console.log(chalk.green.bold('ROBLOX PLAYER INFORMATION'));
        console.log(chalk.green('='.repeat(50)));
        
        console.log(chalk.cyan.bold(`Username: `) + chalk.white(userInfo.username));
        console.log(chalk.cyan.bold(`Display Name: `) + chalk.white(userInfo.displayName));
        console.log(chalk.cyan.bold(`User ID: `) + chalk.white(userInfo.userId));
        console.log(chalk.cyan.bold(`Created: `) + chalk.white(userInfo.created));
        console.log(chalk.cyan.bold(`Status: `) + chalk.white(userInfo.isBanned ? 'Banned' : 'Active'));
        
        console.log(chalk.cyan.bold(`Description: `) + chalk.white(userInfo.description));
        
        if (additionalInfo.presence) {
            const statusMap = {
                0: 'Offline',
                1: 'Online',
                2: 'InGame',
                3: 'InStudio'
            };
            const status = statusMap[additionalInfo.presence.userPresenceType] || 'Unknown';
            console.log(chalk.cyan.bold(`Current Status: `) + chalk.white(status));
        }

        if (additionalInfo.badges) {
            console.log(chalk.cyan.bold(`Badges Count: `) + chalk.white(additionalInfo.badges.count));
            if (additionalInfo.badges.recent.length > 0) {
                console.log(chalk.cyan.bold(`Recent Badges: `) + chalk.white(additionalInfo.badges.recent.join(', ')));
            }
        }

        console.log(chalk.cyan.bold(`Profile Link: `) + chalk.blue.underline(userInfo.profileLink));
        console.log(chalk.cyan.bold(`Avatar Link: `) + chalk.blue.underline(userInfo.avatarLink));
        console.log(chalk.green('='.repeat(50)) + '\n');
    }

    async promptUser() {
        const questions = [
            {
                type: 'input',
                name: 'userId',
                message: 'Enter Roblox User ID:',
                validate: (input) => {
                    if (!input) return 'Please enter a User ID';
                    if (isNaN(input)) return 'User ID must be a number';
                    return true;
                }
            },
            {
                type: 'confirm',
                name: 'getAdditional',
                message: 'Fetch additional information (presence, badges)?',
                default: true
            }
        ];

        const answers = await inquirer.prompt(questions);
        return answers;
    }

    async run() {
        console.log(chalk.yellow.bold('\n🤖 Roblox Player Lookup Tool'));
        console.log(chalk.yellow('==============================\n'));

        try {
            const { userId, getAdditional } = await this.promptUser();
            
            const result = await this.getUserInfo(userId);
            
            if (!result.success) {
                console.log(chalk.red.bold('Error: ') + chalk.red(result.error));
                return;
            }

            let additionalInfo = {};
            if (getAdditional) {
                additionalInfo = await this.getAdditionalInfo(userId);
            }

            this.displayPlayerInfo(result.data, additionalInfo);

        } catch (error) {
            console.log(chalk.red.bold('Unexpected error: ') + chalk.red(error.message));
        }
    }
}

// Run the application
const app = new RobloxPlayerLookup();

// Handle command line arguments
if (process.argv.length > 2) {
    const userId = process.argv[2];
    const app = new RobloxPlayerLookup();
    
    app.getUserInfo(userId)
        .then(result => {
            if (result.success) {
                app.displayPlayerInfo(result.data);
            } else {
                console.log(chalk.red(result.error));
            }
        })
        .catch(error => {
            console.log(chalk.red('Error:', error.message));
        });
} else {
    app.run();
}
