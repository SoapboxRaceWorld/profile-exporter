var express = require('express');
var router = express.Router();
const axios = require('axios')
const url = require('url')
const crypto = require('crypto')
const urljoin = require('url-join')
const querystring = require('querystring')
const xmlParser = require('fast-xml-parser')
const servercomm = require('../lib/servercomm')
const AdmZip = require('adm-zip')

/* GET home page. */
router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'Profile Exporter'
    });
});

router.post('/', function(req, res, next) {
    const { server, email, password } = req.body

    if (!server || !email || !password) {
        res.status(422).send('lol try again')
        return
    }

    res.status(200)

    const passwordHash = crypto.createHash('sha1').update(password).digest().toString('hex');
    const authURL = urljoin(server, `User/authenticateUser?email=${querystring.escape(email).replace('%40', '@')}&password=${querystring.escape(passwordHash)}`);

    axios.default.get(authURL).then(function(response) {
        const loginStatus = response.data
        const parsed = xmlParser.parse(loginStatus)
        const token = parsed.LoginStatusVO.LoginToken
        const userId = parsed.LoginStatusVO.UserId

        console.log(`loginToken = ${parsed.LoginStatusVO.LoginToken}, userId = ${parsed.LoginStatusVO.UserId}`)

        return servercomm.sendServerPost(urljoin(server, 'User/GetPermanentSession'), token, userId).then(async function(response) {
            console.log(response.data)
            const sessionData = response.data
            const parsed = xmlParser.parse(sessionData)

            const newToken = parsed.UserInfo.user.securityToken

            const personas = parsed.UserInfo.personas.ProfileData
            const zip = new AdmZip();
            zip.addFile("personas/", Buffer.from(new Uint8Array(0)))
            zip.addFile("DriverPersona/", Buffer.from(new Uint8Array(0)))
            zip.addFile("User/GetPermanentSession.xml", Buffer.from(sessionData, 'utf8'))

            console.log("COUNT: " + Object.keys(personas).length);

            if (Object.keys(personas).length < 4) {
                for (let persona of personas) {
                    zip.addFile(`personas/${persona.PersonaId}/`, Buffer.from(new Uint8Array(0)))

                    await servercomm.sendServerPost(urljoin(server, 'User/SecureLoginPersona?personaId=' + persona.PersonaId), newToken, userId)

                    const carsResponse = (await servercomm.sendServerGet(urljoin(server, `personas/${persona.PersonaId}/cars`), newToken, userId)).data
                    const carslotsResponse = (await servercomm.sendServerGet(urljoin(server, `personas/${persona.PersonaId}/carslots`), newToken, userId)).data
                    const defcarResponse = (await servercomm.sendServerGet(urljoin(server, `personas/${persona.PersonaId}/defaultcar`), newToken, userId)).data
                    const objectsResponse = (await servercomm.sendServerGet(urljoin(server, `personas/inventory/objects`), newToken, userId)).data
                    const pInfoResponse = (await servercomm.sendServerGet(urljoin(server, `DriverPersona/GetPersonaInfo?personaId=${persona.PersonaId}`), newToken, userId)).data
                    const pBaseResponse = (await servercomm.sendServerPost(urljoin(server, `DriverPersona/GetPersonaBaseFromList`), newToken, userId, `<PersonaIdArray><PersonaIds><long>${persona.PersonaId}</long></PersonaIds></PersonaIdArray>`)).data

                    zip.addFile(`personas/${persona.PersonaId}/cars.xml`, Buffer.from(carsResponse, 'utf8'))
                    zip.addFile(`personas/${persona.PersonaId}/carslots.xml`, Buffer.from(carslotsResponse, 'utf8'))
                    zip.addFile(`personas/${persona.PersonaId}/defaultcar.xml`, Buffer.from(defcarResponse, 'utf8'))
                    zip.addFile(`personas/${persona.PersonaId}/objects.xml`, Buffer.from(objectsResponse, 'utf8'))
                    zip.addFile(`DriverPersona/GetPersonaInfo_${persona.PersonaId}.xml`, Buffer.from(pInfoResponse, 'utf8'))
                    zip.addFile(`DriverPersona/GetPersonaBaseFromList_${persona.PersonaId}.xml`, Buffer.from(pBaseResponse, 'utf8'))
                }
            } else {
                const onlypersona = personas.PersonaId;
                console.log("ONE PERSONA: " + onlypersona);

                zip.addFile(`personas/${onlypersona}/`, Buffer.from(new Uint8Array(0)))

                await servercomm.sendServerPost(urljoin(server, 'User/SecureLoginPersona?personaId=' + onlypersona), newToken, userId)

                const carsResponse = (await servercomm.sendServerGet(urljoin(server, `personas/${onlypersona}/cars`), newToken, userId)).data
                const carslotsResponse = (await servercomm.sendServerGet(urljoin(server, `personas/${onlypersona}/carslots`), newToken, userId)).data
                const defcarResponse = (await servercomm.sendServerGet(urljoin(server, `personas/${onlypersona}/defaultcar`), newToken, userId)).data
                const objectsResponse = (await servercomm.sendServerGet(urljoin(server, `personas/inventory/objects`), newToken, userId)).data
                const pInfoResponse = (await servercomm.sendServerGet(urljoin(server, `DriverPersona/GetPersonaInfo?personaId=${onlypersona}`), newToken, userId)).data
                const pBaseResponse = (await servercomm.sendServerPost(urljoin(server, `DriverPersona/GetPersonaBaseFromList`), newToken, userId, `<PersonaIdArray><PersonaIds><long>${onlypersona}</long></PersonaIds></PersonaIdArray>`)).data

                zip.addFile(`personas/${onlypersona}/cars.xml`, Buffer.from(carsResponse, 'utf8'))
                zip.addFile(`personas/${onlypersona}/carslots.xml`, Buffer.from(carslotsResponse, 'utf8'))
                zip.addFile(`personas/${onlypersona}/defaultcar.xml`, Buffer.from(defcarResponse, 'utf8'))
                zip.addFile(`personas/${onlypersona}/objects.xml`, Buffer.from(objectsResponse, 'utf8'))
                zip.addFile(`DriverPersona/GetPersonaInfo_${onlypersona}.xml`, Buffer.from(pInfoResponse, 'utf8'))
                zip.addFile(`DriverPersona/GetPersonaBaseFromList_${onlypersona}.xml`, Buffer.from(pBaseResponse, 'utf8'))
            }
            res.status(200).send(zip.toBuffer())
        }).catch(function(error) {
            console.log(error.response ? error.response : error, error.response ? `${error.response.data} [${error.response.status}]` : "")

            res.status(500).send(error)
        })
    }).catch(function(error) {
        console.log(error.message, error.response ? error.response.data : "")

        const loginStatus = error.response.data
        const parsed = xmlParser.parse(loginStatus)

        res.status(500).send(parsed.LoginStatusVO.Description)
    })
})

module.exports = router;
