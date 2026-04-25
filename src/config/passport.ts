import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import User from '../models/user';
import { env, isGoogleOAuthConfigured } from './env';

/**
 * Configuracion de Passport con la estrategia Google OAuth 2.0.
 * Si las credenciales de Google no estan presentes, la estrategia no se
 * registra y los endpoints relacionados respondes 503 al ser invocados.
 */
export function configurePassport(): void {
    passport.serializeUser((user: any, done) => {
        done(null, user._id ?? user.id);
    });

    passport.deserializeUser(async (id: string, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (error) {
            done(error as Error);
        }
    });

    if (!isGoogleOAuthConfigured()) {
        console.warn(
            '[passport] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET no definidos. Login con Google deshabilitado.'
        );
        return;
    }

    passport.use(
        new GoogleStrategy(
            {
                clientID: env.GOOGLE_CLIENT_ID,
                clientSecret: env.GOOGLE_CLIENT_SECRET,
                callbackURL: env.GOOGLE_CALLBACK_URL,
            },
            async (
                _accessToken: string,
                _refreshToken: string,
                profile: Profile,
                done
            ) => {
                try {
                    const email =
                        profile.emails && profile.emails[0]?.value
                            ? profile.emails[0].value.toLowerCase()
                            : undefined;

                    if (!email) {
                        return done(
                            new Error('La cuenta de Google no expone un email valido.')
                        );
                    }

                    let user = await User.findOne({
                        $or: [{ googleId: profile.id }, { email }],
                    });

                    if (!user) {
                        const givenName = profile.name?.givenName ?? 'Usuario';
                        const familyName = profile.name?.familyName ?? 'Google';
                        const avatar = profile.photos?.[0]?.value;

                        user = await User.create({
                            name: givenName,
                            last_name: familyName,
                            email,
                            birthdate: new Date('1970-01-01'),
                            phone_number: 'N/A',
                            password: `oauth:${profile.id}`,
                            googleId: profile.id,
                            authProvider: 'google',
                            avatarUrl: avatar,
                            bank: 0,
                        });
                    } else if (!user.googleId) {
                        user.googleId = profile.id;
                        user.authProvider = 'google';
                        if (!user.avatarUrl && profile.photos?.[0]?.value) {
                            user.avatarUrl = profile.photos[0].value;
                        }
                        await user.save();
                    }

                    return done(null, user);
                } catch (error) {
                    return done(error as Error);
                }
            }
        )
    );
}

export default passport;
