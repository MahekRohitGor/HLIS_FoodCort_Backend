var database = require("../config/database");
var cryptLib = require("cryptlib");
var constants = require("../config/constants");
const nodemailer = require("nodemailer");
const response_code = require("./response-error-code");
const {default: localizify} = require('localizify');
const { t } = require('localizify');

class common{
    generateOtp(length){
        if(length <= 0){
            throw new Error("OTP length must be greater than 0");
        }
        const digits = '0123456789';
        let otp = '';
        for (let i = 0; i < length; i++) {
            otp += digits[Math.floor(Math.random() * digits.length)];
        }
        return otp;
    }

    generateToken(length){
        if(length <= 0){
            throw new Error("Token length must be greater than 0");
        }
        const alphaNumeric = '0123456789qwertyuiopasdfghjklzxcvbnm';
        let token = '';
        for (let i = 0; i < length; i++) {
            token += alphaNumeric[Math.floor(Math.random() * alphaNumeric.length)];
        }
        return token;
    }

    async requestValidation(v) {
        if (v.fails()) {
            const Validator_errors = v.getErrors();
            const error = Object.values(Validator_errors)[0][0];
            return {
                code: true,
                message: error
            };
        } 
        return {
            code: false,
            message: ""
        };
    }

    async sendMail(subject, to_email, htmlContent) {
        try {
            if (!to_email || to_email.trim() === "") {
                throw new Error("Recipient email is empty or undefined!");
            }

            const transporter = nodemailer.createTransport({
                service: 'gmail',
                host: 'smtp.gmail.com',
                port: 587,
                secure: false,
                auth: {
                    user: constants.mailer_email,
                    pass: constants.mailer_password
                }
            });

            const mailOptions = {
                from: constants.from_email,
                to: to_email,
                subject: subject,
                html: htmlContent,
                text: "Please enable HTML to view this email.",
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(info);
            return { success: true, info };
        } catch (error) {
            console.log(error);
            return { success: false, error };
        }
    }

    async response(res, message){
        return res.json(this.encrypt(message));
    }

    async getUserDetail(user_id, login_user_id, callback){
        var selectUserQuery = "SELECT * from tbl_user where user_id = ?";
        
        try{

            const [user] = await database.query(selectUserQuery, [user_id])
            if(user.length > 0){
                return callback(undefined, user[0]);
            }
            else{
                return callback("No User Found", []);
            }

        } catch(error){

            return callback(error, []);
        }
    }

    async getUserDetailLogin(user_id, callback){
        console.log("User ID:", user_id);
        var selectUserQuery;
        selectUserQuery = "SELECT * from tbl_user where user_id = ?";
        
        try{

            const [user] = await database.query(selectUserQuery, [user_id])
            console.log("User", user);
            if(user.length > 0){
                return callback(undefined, user[0]);
            }
            else{
                return callback("No User Found", []);
            }

        } catch(error){

            return callback(error, []);
        }
    }

    async updateOtp(user_id) {
        const newOtp = this.generateOtp(4);
        console.log("OTP SENT: ", newOtp);
        const updateOtpQuery = `UPDATE tbl_otp SET otp = ?, verify = 0, is_deleted = 0, is_active = 1 WHERE user_id = ?`;
        await database.query(updateOtpQuery, [newOtp, user_id]);
    }

    async findExistingUser(database, email_id, phone_number = null) {
                const findUserQuery = `SELECT * FROM tbl_user WHERE (email_id = ? OR phone_number = ?) AND is_deleted = 0`;
                console.log(findUserQuery);
                
                const [existingUser] = await database.query(findUserQuery, [email_id, phone_number || email_id]);
                console.log(existingUser);
                
                return existingUser;
    }
            
    async handleExistingUserOTP(database, user) {
                if (user.otp) {
                    return {
                        code: response_code.VERIFICATION_PENDING,
                        message: t('verify_account_user_exists')
                    };
                }
            
                const otp_ = this.generateOtp(4);
                const subject = "Cargo Rider - OTP for Verification";
                const email = user.email_id;
    
                const data = {
                    name: user.full_name || 'User',
                    otp: otp_
                }
                
                try {
                    const htmlMessage = sendOTP(data);
                    await this.sendMail(subject, email, htmlMessage);
                    console.log("OTP email sent successfully!");
                } catch (error) {
                    console.error("Error sending OTP email:", error);
                }
    
                const updateOtpQuery = `UPDATE tbl_user SET otp = ? WHERE user_id = ?`;
                await database.query(updateOtpQuery, [otp_, user.user_id]);
            
                return {
                    code: response_code.VERIFICATION_PENDING,
                    message: t('otp_sent_please_verify_acc'),
                    data: user.email_id
                };
    }

    async format_cart_data(cart_data){
        console.log(cart_data);
        const grouped_items = {};

        cart_data.forEach(row => {
            if(!grouped_items[row.cart_id]){
                grouped_items[row.cart_id] = {
                    item_id: row.item_id,
                    item_qty: row.item_qty,
                    ings: []
                }

                if (row.ing_id) {
                    grouped_items[row.cart_id].ings.push({
                      ing_id: row.ing_id,
                      ing_qty: row.ing_qty
                    });
                  }
            }

            else{
                if (row.ing_id) {
                    grouped_items[row.cart_id].ings.push({
                      ing_id: row.ing_id,
                      ing_qty: row.ing_qty
                    });
                  }
            }

        });

        const result = {
            items: Object.values(grouped_items)
          };

        console.log(result);
        
        return result;
    }

    async get_discount(sub_total, voucher_code){
        const discount_amt = 0;
        if (voucher_code) {
            const [discountData] = await database.query(
                `SELECT * from tbl_voucher where voucher_code = ?`, 
                [voucher_code]
            );

            if (discountData.length > 0) {
                const discountPercentage = discountData[0].discount_percentage;
                discount_amt = (sub_total * discountPercentage) / 100;
            }
        }

        return discount_amt;
    }

    async insert_into_order(data) {
        const [result] = await database.query(`INSERT INTO tbl_order SET ?`, data);
        return result.insertId;
    }
    
    async update_order(order_id, data) {
        await database.query(`UPDATE tbl_order SET ? WHERE order_id = ?`, [data, order_id]);
    }
    
    async updateUserInfo(user_id, user_data, callback){
            const updateFields = { ...user_data};
            const updateQuery = "UPDATE tbl_user u INNER JOIN tbl_otp o ON u.user_id = o.user_id SET o.verify = 1 WHERE o.otp = ? and u.user_id = ? and o.verify = 0";
            
            try{
                const [updatedUser] = await database.query(updateQuery, [updateFields.otp, user_id]);
                console.log("Updated User:", updatedUser);
                if (updatedUser.affectedRows > 0) {
                    await this.getUserDetail(user_id, user_id, function(err, userInfo) {
                        console.log("UserInfo: ", userInfo);
                        if (err) {
                            console.log(err);
                            return callback(err, null);
                        } else {
                            console.log(userInfo);
                            return callback(null, userInfo);
                        }
                });
                } else {
                    return callback("Either NO USER FOUND or Your Email ID is already verified", null);
                }

            } catch(error){
                return callback(error, null);
            }

        }

    async updateUserInfoGeneral(id, data, callback){
        var updateUserQuery = "UPDATE tbl_user SET ? where user_id = ?";
        try{
            const [result] = database.query(updateUserQuery, [data, id]);
            this.getUserDetail(id, id, (error, result)=>{
                if(error){
                    return callback(error, undefined);
                } else{
                    return callback(undefined, result);
                }
            });

        }catch(error){
            return callback(error, undefined);
        }
    }

    async findExistingDriver(database, email_id, phone_number = null) {
        const findDriverQuery = `SELECT * FROM tbl_driver WHERE (email_id = ? OR phone_number = ?) AND is_deleted = 0 AND is_active = 1`;
        const [existingDriver] = await database.query(findDriverQuery, [email_id, phone_number || email_id]);
        return existingDriver;
    }
    
    async handleExistingDriverOTP(database, user, callback) {
        if (user.otp) {
            return callback(common.encrypt({
                code: response_code.VERIFICATION_PENDING,
                message: t('verify_account_driver_exists')
            }));
        }
    
        const otp_ = common.generateOtp(4);
        const subject = "Cargo Rider - OTP for Verification";
        const email = user.email_id;

        const data = {
            name: user.full_name || 'User',
            otp: otp_
        }

        try {
            const htmlMessage = sendOTP(data);
            await common.sendMail(subject, email, htmlMessage);
            console.log("OTP email sent successfully!");
        } catch (error) {
            console.error("Error sending OTP email:", error);
        }

        const updateOtpQuery = `UPDATE tbl_driver SET otp = ? WHERE driver_id = ?`;
        await database.query(updateOtpQuery, [otp_, user.driver_id]);
    
        return callback(common.encrypt({
            code: response_code.VERIFICATION_PENDING,
            message: t('otp_sent_please_verify_acc'),
            data: user.email_id
        }));
    }

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    encrypt(data) {
        return cryptLib.encrypt(JSON.stringify(data), constants.encryptionKey, constants.encryptionIV);
    }
    decryptPlain(data) {
        return cryptLib.decrypt(data, constants.encryptionKey, constants.encryptionIV);
    }
    decryptString (data){
        try{
            if(data){
                return cryptLib.decrypt(data, constants.encryptionKey, constants.encryptionIV);
            }else{
                return;
            }
        }catch(error){
            return error;
        }
    }
}

module.exports = new common();