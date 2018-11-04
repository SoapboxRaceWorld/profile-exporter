const axios = require('axios')

module.exports = {
    sendServerGet(url, userToken, userId) {
        return axios.default.get(url, {
            headers: {
                'securityToken': userToken,
                'userID': userId
            }
        })
    },
    sendServerPost(url, userToken, userId, content) {
        return axios.default.post(url, content, {
            headers: {
                'securityToken': userToken,
                'userID': userId
            }
        })
    }
}