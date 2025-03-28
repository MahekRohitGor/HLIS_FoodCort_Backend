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
        app.post("/v1/user/add-to-cart", users.add_to_cart);
        app.post("/v1/user/place-order", users.place_order);
        app.post("/v1/user/list-order", users.list_user_order);
        app.post("/v1/user/list-user-favs", users.list_user_favs);
        app.post("/v1/user/list-notifications", users.list_notifications);
        app.post("/v1/user/add-address", users.add_delivery_address);
        app.post("/v1/user/add-payment", users.add_payment_method);
        app.post("/v1/user/track-order", users.order_track);
        app.post("/v1/user/list-voucher", users.list_voucher);
        app.post("/v1/user/list-reviews", users.list_reviews);
        app.post("/v1/user/edit-profile", users.edit_profile);

}

module.exports = user;