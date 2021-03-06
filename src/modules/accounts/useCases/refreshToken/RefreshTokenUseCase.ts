import { inject, injectable } from 'tsyringe';
import { sign, verify } from 'jsonwebtoken'

import auth from '@config/auth';

import { AppError } from '@shared/errors/AppError';
import { IDateProvider } from '@shared/container/providers/DateProvider/IDateProvider';
import { IUsersTokensRepository } from '@modules/accounts/repositories/IUsersTokensRepository';

interface IPayLoad {
    sub: string;
    email: string;
}

interface ITokenResponse {
    token: string;
    refresh_token: string;
}

@injectable()
class RefreshTokenUseCase {
    constructor(
        @inject("UsersTokensRepository")
        private usersTokensRepository: IUsersTokensRepository,
        @inject("DayjsDateProvider")
        private dateProvider: IDateProvider,
    ) { }

    async execute(token: string): Promise<ITokenResponse> {
        const { email, sub } = verify(token, auth.secret_refresh_token) as IPayLoad;

        const user_id = sub;

        const user_token = await this.usersTokensRepository.findByUserIdAndRefreshToken(user_id, token);

        if (!user_token) {
            throw new AppError('Refresh token does not exists!');
        }

        await this.usersTokensRepository.deleteById(user_token.id);

        const expires_date = this.dateProvider.addDays(auth.expires_refresh_token_days)

        const refresh_token = sign({ email }, auth.secret_refresh_token, {
            subject: user_id,
            expiresIn: auth.expires_refresh_token_days
        });

        await this.usersTokensRepository.create({
            expires_date,
            refresh_token,
            user_id,
        })

        const newToken = sign({}, auth.secret_token, {
            subject: user_id,
            expiresIn: auth.expires_in_token,
        });

        return {
            token: newToken,
            refresh_token
        };
    }
}

export { RefreshTokenUseCase };