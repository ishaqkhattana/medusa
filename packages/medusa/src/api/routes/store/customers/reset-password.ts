import { IsEmail, IsString } from "class-validator"
import jwt, { JwtPayload } from "jsonwebtoken"

import CustomerService from "../../../../services/customer"
import { EntityManager } from "typeorm"
import { validator } from "../../../../utils/validator"

/**
 * @oas [post] /customers/password-reset
 * operationId: PostCustomersResetPassword
 * summary: Resets Customer password
 * description: "Resets a Customer's password using a password token created by a previous /password-token request."
 * requestBody:
 *   content:
 *     application/json:
 *       schema:
 *         required:
 *           - email
 *           - password
 *           - token
 *         properties:
 *           email:
 *             description: "The email of the customer."
 *             type: string
 *             format: email
 *           password:
 *             description: "The Customer's password."
 *             type: string
 *             format: password
 *           token:
 *             description: "The reset password token"
 *             type: string
 * x-codeSamples:
 *   - lang: JavaScript
 *     label: JS Client
 *     source: |
 *       import Medusa from "@medusajs/medusa-js"
 *       const medusa = new Medusa({ baseUrl: MEDUSA_BACKEND_URL, maxRetries: 3 })
 *       medusa.customers.resetPassword({
 *         email: 'user@example.com',
 *         password: 'supersecret',
 *         token: 'supersecrettoken'
 *       })
 *       .then(({ customer }) => {
 *         console.log(customer.id);
 *       });
 *   - lang: Shell
 *     label: cURL
 *     source: |
 *       curl --location --request POST 'https://medusa-url.com/store/customers/password-reset' \
 *       --header 'Content-Type: application/json' \
 *       --data-raw '{
 *           "email": "user@example.com",
 *           "password": "supersecret",
 *           "token": "supersecrettoken"
 *       }'
 * tags:
 *   - Customer
 * responses:
 *   200:
 *     description: OK
 *     content:
 *       application/json:
 *         schema:
 *           properties:
 *             customer:
 *               $ref: "#/components/schemas/customer"
 *   "400":
 *     $ref: "#/components/responses/400_error"
 *   "401":
 *     $ref: "#/components/responses/unauthorized"
 *   "404":
 *     $ref: "#/components/responses/not_found_error"
 *   "409":
 *     $ref: "#/components/responses/invalid_state_error"
 *   "422":
 *     $ref: "#/components/responses/invalid_request_error"
 *   "500":
 *     $ref: "#/components/responses/500_error"
 */
export default async (req, res) => {
  const validated = await validator(
    StorePostCustomersResetPasswordReq,
    req.body
  )

  const customerService: CustomerService = req.scope.resolve("customerService")
  let customer = await customerService.retrieveByEmail(validated.email, {
    select: ["id", "password_hash"],
  })

  const decodedToken = jwt.verify(
    validated.token,
    customer.password_hash
  ) as JwtPayload
  if (!decodedToken || customer.id !== decodedToken.customer_id) {
    res.status(401).send("Invalid or expired password reset token")
    return
  }

  const manager: EntityManager = req.scope.resolve("manager")
  await manager.transaction(async (transactionManager) => {
    return await customerService
      .withTransaction(transactionManager)
      .update(customer.id, {
        password: validated.password,
      })
  })

  customer = await customerService.retrieve(customer.id)
  res.status(200).json({ customer })
}

export class StorePostCustomersResetPasswordReq {
  @IsEmail()
  email: string

  @IsString()
  token: string

  @IsString()
  password: string
}
