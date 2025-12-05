const db = require('./index');

const InstalledModulesRepo = {
    async getAll(shopId) {
        const result = await db.query(
            `SELECT * FROM installed_modules WHERE shop_id = $1 ORDER BY installed_at DESC`,
            [shopId]
        );
        return result.rows;
    },

    async getEnabled(shopId) {
        const result = await db.query(
            `SELECT * FROM installed_modules WHERE shop_id = $1 AND is_enabled = true ORDER BY position`,
            [shopId]
        );
        return result.rows;
    },

    async getByName(shopId, moduleName) {
        const result = await db.query(
            `SELECT * FROM installed_modules WHERE shop_id = $1 AND module_name = $2`,
            [shopId, moduleName]
        );
        return result.rows[0] || null;
    },

    async install(data) {
        const result = await db.query(
            `INSERT INTO installed_modules (shop_id, module_name, github_url, author, description, image_url, config, position, is_enabled)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
             ON CONFLICT (shop_id, module_name) DO UPDATE SET
                github_url = EXCLUDED.github_url,
                author = EXCLUDED.author,
                description = EXCLUDED.description,
                image_url = EXCLUDED.image_url,
                is_enabled = true
             RETURNING *`,
            [
                data.shop_id,
                data.module_name,
                data.github_url || null,
                data.author || null,
                data.description || null,
                data.image_url || null,
                JSON.stringify(data.config || {}),
                data.position || 'bottom_right',
                true
            ]
        );
        return result.rows[0];
    },

    async uninstall(shopId, moduleName) {
        const result = await db.query(
            `DELETE FROM installed_modules WHERE shop_id = $1 AND module_name = $2 RETURNING *`,
            [shopId, moduleName]
        );
        return result.rows[0];
    },

    async updateConfig(shopId, moduleName, config) {
        const result = await db.query(
            `UPDATE installed_modules SET config = $3 WHERE shop_id = $1 AND module_name = $2 RETURNING *`,
            [shopId, moduleName, JSON.stringify(config)]
        );
        return result.rows[0];
    },

    async updatePosition(shopId, moduleName, position) {
        const result = await db.query(
            `UPDATE installed_modules SET position = $3 WHERE shop_id = $1 AND module_name = $2 RETURNING *`,
            [shopId, moduleName, position]
        );
        return result.rows[0];
    },

    async toggleEnabled(shopId, moduleName, isEnabled) {
        const result = await db.query(
            `UPDATE installed_modules SET is_enabled = $3 WHERE shop_id = $1 AND module_name = $2 RETURNING *`,
            [shopId, moduleName, isEnabled]
        );
        return result.rows[0];
    }
};

module.exports = InstalledModulesRepo;
