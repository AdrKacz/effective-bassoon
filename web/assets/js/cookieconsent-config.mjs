import 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.1.0/dist/cookieconsent.umd.js';

// Enable dark mode
document.documentElement.classList.add('cc--darkmode');

CookieConsent.run({
    onConsent: ({cookie}) => {
        function gtag() { dataLayer.push(arguments); }
        gtag('consent', 'update', {
          ad_user_data: cookie.categories?.includes('marketing') ? 'granted' : 'denied',
          ad_personalization: cookie.categories?.includes('marketing') ? 'granted' : 'denied',
          ad_storage: cookie.categories?.includes('marketing') ? 'granted' : 'denied',
          analytics_storage: cookie.categories?.includes('marketing') ? 'granted' : 'denied',
        });
    },
    guiOptions: {
        consentModal: {
            layout: "box",
            position: "bottom left",
            equalWeightButtons: false,
            flipButtons: false
        },
        preferencesModal: {
            layout: "box",
            position: "right",
            equalWeightButtons: false,
            flipButtons: false
        }
    },
    categories: {
        necessary: {
            readOnly: true
        },
        marketing: {}
    },
    language: {
        default: "fr",
        autoDetect: "browser",
        translations: {
            fr: {
                consentModal: {
                    title: "On garde juste le minimum pour que ça marche",
                    description: "On utilise quelques cookies pour que le site fonctionne bien, et pour mieux comprendre ce que tu aimes. Tu peux choisir ce qu’on garde ou tout refuser. C’est simple.",
                    closeIconLabel: "",
                    acceptAllBtn: "Tout accepter",
                    acceptNecessaryBtn: "Tout rejeter",
                    showPreferencesBtn: "Gérer les préférences",
                    footer: "<a href=\"/cgu\">Conditions générales d'utilisation</a>\n<a href=\"/policy\">Politique de confidentialité</a>"
                },
                preferencesModal: {
                    title: "Préférences",
                    closeIconLabel: "Fermer la modale",
                    acceptAllBtn: "Tout accepter",
                    acceptNecessaryBtn: "Tout rejeter",
                    savePreferencesBtn: "Sauvegarder les préférences",
                    serviceCounterLabel: "Services",
                    sections: [
                        {
                            title: "À quoi servent les cookies ?",
                            description: "Les cookies qu’on utilise servent à faire tourner le site correctement, mais aussi à te proposer un contenu plus adapté. En les acceptant, tu nous aides à te rendre la vie plus simple ici."
                        },
                        {
                            title: "Cookies Strictement Nécessaires <span class=\"pm__badge\">Toujours Activé</span>",
                            description: "Indispensables pour que le site fonctionne : chargement, sécurité, navigation… On ne peut pas s’en passer.",
                            linkedCategory: "necessary"
                        },
                        {
                            title: "Cookies Publicitaires",
                            description: "Ils nous aident à comprendre ce que tu aimes, pour améliorer le site ou te montrer du contenu qui t’intéresse.",
                            linkedCategory: "marketing"
                        },
                        {
                            title: "Plus d'informations",
                            description: "Pour toute question sur notre politique de cookies ou tes préférences, n’hésite pas à <a class=\"cc__link\" href=\"/contacts\">nous contacter</a>."
                        }
                    ]
                }
            }
        }
    },
    disablePageInteraction: true
});