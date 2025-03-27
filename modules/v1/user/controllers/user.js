var userModel = require("../models/user_model");
var common = require("../../../../utilities/common");
const response_code = require("../../../../utilities/response-error-code");
const {default: localizify} = require('localizify');
const validator = require("../../../../middlewares/validator");
const { t } = require('localizify');
const vrules = require("../../../validation_rules");

class User{
    async signup(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const response_data = await userModel.signup(request_data);
        await common.response(res, response_data);
    }

    async verifyOtp(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data))

        const response_data = await userModel.verifyOTP(request_data);
        await common.response(res, response_data);
    }


    async login(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));

        const response_data = await userModel.login(request_data);
        await common.response(res, response_data);
    }

    async home_page_items(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.home_page_items(request_data, user_id);
        await common.response(res, response_data);
    }

    async filter(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.filter(request_data, user_id);
        await common.response(res, response_data);
    }

    async list_item_detail(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.list_item_detail(request_data, user_id);
        await common.response(res, response_data);
    }

    async place_order(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.place_order(request_data, user_id);
        await common.response(res, response_data);
    }

    async list_user_order(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.list_user_order(request_data, user_id);
        await common.response(res, response_data);
    }

    async list_user_favs(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.list_user_favs(request_data, user_id);
        await common.response(res, response_data);
    }

    async list_notifications(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.list_notifications(request_data, user_id);
        await common.response(res, response_data);
    }

    async add_delivery_address(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.add_delivery_address(request_data, user_id);
        await common.response(res, response_data);
    }

    async add_payment_method(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.add_payment_method(request_data, user_id);
        await common.response(res, response_data);
    }

    async order_track(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.order_track(request_data, user_id);
        await common.response(res, response_data);
    }

    async list_voucher(req,res){
        const requested_data = req.body;
        const request_data = JSON.parse(common.decryptPlain(requested_data));
        const user_id = req.user_id;

        const response_data = await userModel.list_voucher(request_data, user_id);
        await common.response(res, response_data);
    }
    
}


module.exports = new User();