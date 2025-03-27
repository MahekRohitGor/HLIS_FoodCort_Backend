const users = require("../controllers/user");
const { UserImageUpload, UserReportImage } = require('../../../../middlewares/uploadFiles');

const user = (app) =>{
        // Auth
        app.post("/v1/user/signup", users.signup);
        app.post("/v1/user/verifyOtp", users.verifyOtp);
        app.post("/v1/user/login", users.login);

        // Home Screen
        app.post("/v1/user/home-page", users.home_page_items);
        app.post("/v1/user/filter", users.filter);
        app.post("/v1/user/list-item-detail", users.list_item_detail);
        app.post("/v1/user/place-order", users.place_order);

}

module.exports = user;