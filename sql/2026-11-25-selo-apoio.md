# 25/11 · Selo de apoio (raio)
- Migração `selo_apoio` no Supabase: privado.apoio_conta, privado.apoiador, privado.apoio_estado, privado.apoio_selo_sync,
  gatilho apoio_selo em public.apoios, public.apoio_cria(valor, ip, mensal, conta) só service_role,
  public.apoio_selo_mostrar e public.apoio_vinculo_desfaz (authenticated), minha_reputacao com `apoio`.
- selos_casa e selos_confere preservam 'apoio'/'apoiomes'.
- Função apoio-cobra v10: conta vem só do token no cabeçalho x-conta, conferido no servidor, e só com selo=true.
